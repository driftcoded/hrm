import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Steps,
  Switch,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useAllDepartments } from '@/hooks/useDepartments';
import { usePositions } from '@/hooks/usePositions';
import { useProvinces, useWards } from '@/hooks/useProvinces';
import { useRoles } from '@/hooks/useEmployees';
import { flattenDepartmentTree } from '@/utils/departmentTree';
import {
  CONTRACT_TYPES,
  EDUCATION_LEVELS,
  GENDERS,
  MARITAL_STATUSES,
  type ContractTypeValue,
  type CreateContractPayload,
  type CreateEmployeePayload,
  type CreateUserPayload,
  type EducationLevel,
  type EmployeeStatus,
  type Gender,
  type MaritalStatus,
} from '@/types/employee.types';
import styles from './EmployeeWizard.module.css';

/**
 * "Wizard tạo NV 4 bước: cơ bản → công việc → lương → tài khoản" (PLAN §3.2).
 *
 * ONE `Form` instance across all four steps, with the inactive panes hidden by
 * CSS rather than unmounted. That is what makes going back and forth free: an
 * unmounted `Form.Item` drops its value, so a wizard that swaps panes has to
 * marshal state by hand and loses anything the user typed in a step they
 * revisited. Here the values simply stay.
 *
 * NEXT IS GATED (PLAN test §3.2): `handleNext` validates only the CURRENT
 * step's fields, so an incomplete step 1 cannot reach step 2, while a required
 * field in step 3 never blocks step 1. Validation errors land next to the field
 * they belong to, and the submit error lands inline at the bottom — no toast for
 * either (docs/ui-conventions.md §8).
 *
 * WHAT IT SUBMITS — up to three calls, in order, because these are three
 * different records:
 *   1. `POST /employees`   — always.
 *   2. `POST /contracts`   — only if the contract block was filled in.
 *   3. `POST /users`       — only if the account block was filled in AND the
 *                            signed-in user is an admin.
 * If 2 or 3 fails, the employee from step 1 STILL EXISTS. The wizard says so
 * explicitly instead of pretending the whole thing rolled back, and closes so
 * the user can finish from the employee's detail page. Anything else would be a
 * lie about what is in the database.
 *
 * AVATAR is not here: `POST /employees/:id/avatar` needs an id that does not
 * exist until step 1 succeeds. It lives on the detail page.
 */

export interface EmployeeWizardResult {
  employeeId: number;
  employeeCode: string;
  /** Set when the contract/account call failed after the employee was created. */
  partialError: string | null;
}

export interface EmployeeWizardProps {
  open: boolean;
  onCancel: () => void;
  /** Runs the three calls; the page owns the mutations. */
  onSubmit: (input: {
    employee: CreateEmployeePayload;
    contract: Omit<CreateContractPayload, 'employeeId'> | null;
    account: Omit<CreateUserPayload, 'employeeId'> | null;
  }) => Promise<EmployeeWizardResult>;
  isSaving: boolean;
  /** Whether to show step 4 at all — only `admin` may create accounts. */
  canCreateAccount: boolean;
}

interface WizardValues {
  // --- step 1
  lastName: string;
  firstName: string;
  dateOfBirth: Dayjs;
  gender: Gender;
  maritalStatus?: MaritalStatus;
  placeOfBirth: string;
  hometown: string;
  cccdNumber: string;
  cccdIssueDate: Dayjs;
  cccdIssuePlace: string;
  phone: string;
  email: string;
  personalEmail?: string;
  permanentAddress: string;
  currentAddress?: string;
  provinceCode: string;
  wardCode: string;
  // --- step 2
  departmentId: number;
  positionId: number;
  hireDate: Dayjs;
  probationStartDate?: Dayjs;
  probationEndDate?: Dayjs;
  status?: EmployeeStatus;
  educationLevel?: EducationLevel;
  major?: string;
  university?: string;
  graduationYear?: number;
  // --- step 3
  bankAccount?: string;
  bankName?: string;
  bankBranch?: string;
  withContract: boolean;
  contractNumber?: string;
  contractType?: ContractTypeValue;
  contractStartDate?: Dayjs;
  contractEndDate?: Dayjs;
  signDate?: Dayjs;
  baseSalary?: number;
  insuranceSalary?: number;
  positionAllowance?: number;
  otherAllowance?: number;
  activateContract?: boolean;
  // --- step 4
  withAccount: boolean;
  username?: string;
  accountEmail?: string;
  password?: string;
  roleId?: number;
}

/** Which fields each step owns — drives the per-step validation on "Next". */
const STEP_FIELDS: Array<Array<keyof WizardValues>> = [
  [
    'lastName',
    'firstName',
    'dateOfBirth',
    'gender',
    'placeOfBirth',
    'hometown',
    'cccdNumber',
    'cccdIssueDate',
    'cccdIssuePlace',
    'phone',
    'email',
    'personalEmail',
    'permanentAddress',
    'provinceCode',
    'wardCode',
  ],
  ['departmentId', 'positionId', 'hireDate', 'probationStartDate', 'probationEndDate'],
  [
    'contractNumber',
    'contractType',
    'contractStartDate',
    'contractEndDate',
    'signDate',
    'baseSalary',
    'insuranceSalary',
  ],
  ['username', 'accountEmail', 'password', 'roleId'],
];

const CCCD_PATTERN = /^\d{12}$/;
const PHONE_PATTERN = /^(0\d{9}|\+84\d{9})$/;
const AREA_CODE_PATTERN = /^\d{1,10}$/;

const toIsoDate = (value: Dayjs | undefined): string | undefined =>
  value ? value.format('YYYY-MM-DD') : undefined;

export function EmployeeWizard({
  open,
  onCancel,
  onSubmit,
  isSaving,
  canCreateAccount,
}: EmployeeWizardProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<WizardValues>();
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Only fetched while the wizard is open — a closed modal must not keep three
  // reference lists warm.
  const { tree: departmentTree } = useAllDepartments(open);
  const departments = useMemo(() => flattenDepartmentTree(departmentTree), [departmentTree]);
  const { data: provinces, isError: provincesFailed } = useProvinces(open);
  const provinceCode = Form.useWatch('provinceCode', form);
  const { data: wards, isFetching: wardsLoading, isError: wardsFailed } = useWards(
    provinceCode,
    open,
  );
  const { data: roles } = useRoles(open && canCreateAccount);

  const departmentId = Form.useWatch('departmentId', form);
  const withContract = Form.useWatch('withContract', form) ?? false;
  const withAccount = Form.useWatch('withAccount', form) ?? false;
  const contractType = Form.useWatch('contractType', form);

  /**
   * Positions are filtered by the chosen department: the server refuses a
   * position from another department (`POSITION_DEPARTMENT_MISMATCH`), so
   * offering them all would be offering a guaranteed error.
   */
  const positionsResource = usePositions({
    departmentId: departmentId ?? undefined,
    isActive: true,
    limit: 100,
  });
  const positions = positionsResource.data?.items ?? [];

  const steps = canCreateAccount ? 4 : 3;
  const isLastStep = step === steps - 1;

  const handleNext = () => {
    // ONLY this step's fields — see the note on STEP_FIELDS above.
    void form.validateFields(STEP_FIELDS[step]).then(() => {
      setSubmitError(null);
      setStep((current) => Math.min(current + 1, steps - 1));
    });
  };

  const handleBack = () => {
    setSubmitError(null);
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleFinish = () => {
    void form.validateFields().then(async (values) => {
      setSubmitError(null);

      const employee: CreateEmployeePayload = {
        lastName: values.lastName.trim(),
        firstName: values.firstName.trim(),
        dateOfBirth: values.dateOfBirth.format('YYYY-MM-DD'),
        gender: values.gender,
        maritalStatus: values.maritalStatus,
        placeOfBirth: values.placeOfBirth.trim(),
        hometown: values.hometown.trim(),
        cccdNumber: values.cccdNumber.trim(),
        cccdIssueDate: values.cccdIssueDate.format('YYYY-MM-DD'),
        cccdIssuePlace: values.cccdIssuePlace.trim(),
        permanentAddress: values.permanentAddress.trim(),
        currentAddress: values.currentAddress?.trim() || null,
        provinceCode: values.provinceCode,
        // districtCode KHÔNG gửi: cấp huyện đã chấm dứt hoạt động 01/07/2025.
        wardCode: values.wardCode,
        phone: values.phone.trim(),
        email: values.email.trim(),
        personalEmail: values.personalEmail?.trim() || null,
        bankAccount: values.bankAccount?.trim() || null,
        bankName: values.bankName?.trim() || null,
        bankBranch: values.bankBranch?.trim() || null,
        departmentId: values.departmentId,
        positionId: values.positionId,
        hireDate: values.hireDate.format('YYYY-MM-DD'),
        probationStartDate: toIsoDate(values.probationStartDate) ?? null,
        probationEndDate: toIsoDate(values.probationEndDate) ?? null,
        status: values.status,
        educationLevel: values.educationLevel ?? null,
        major: values.major?.trim() || null,
        university: values.university?.trim() || null,
        graduationYear: values.graduationYear ?? null,
      };

      const contract =
        values.withContract && values.contractNumber && values.contractType
          ? {
              contractNumber: values.contractNumber.trim(),
              contractType: values.contractType,
              startDate: values.contractStartDate!.format('YYYY-MM-DD'),
              endDate: toIsoDate(values.contractEndDate) ?? null,
              signDate: values.signDate!.format('YYYY-MM-DD'),
              baseSalary: values.baseSalary!,
              insuranceSalary: values.insuranceSalary!,
              positionAllowance: values.positionAllowance ?? 0,
              otherAllowance: values.otherAllowance ?? 0,
              status: values.activateContract
                ? ('active' as const)
                : ('draft' as const),
            }
          : null;

      const account =
        canCreateAccount && values.withAccount && values.username
          ? {
              username: values.username.trim(),
              email: (values.accountEmail ?? values.email).trim(),
              password: values.password!,
              roleId: values.roleId!,
            }
          : null;

      const result = await onSubmit({ employee, contract, account });

      if (result.partialError) {
        // The employee EXISTS; only the follow-up call failed. Say exactly that.
        setSubmitError(result.partialError);
        return;
      }

      form.resetFields();
      setStep(0);
    });
  };

  const handleCancel = () => {
    form.resetFields();
    setStep(0);
    setSubmitError(null);
    onCancel();
  };

  const stepItems = [
    { title: t('employees.wizard.step1') },
    { title: t('employees.wizard.step2') },
    { title: t('employees.wizard.step3') },
    ...(canCreateAccount ? [{ title: t('employees.wizard.step4') }] : []),
  ];

  /** Hidden, not unmounted — see the component note. */
  const pane = (index: number) => ({
    className: step === index ? styles.pane : styles.paneHidden,
  });

  return (
    <Modal
      open={open}
      title={t('employees.wizard.title')}
      width={860}
      onCancel={handleCancel}
      maskClosable={false}
      destroyOnHidden={false}
      footer={
        <div className={styles.footer}>
          <Button onClick={handleCancel} disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          <div className={styles.footerRight}>
            {step > 0 && (
              <Button onClick={handleBack} disabled={isSaving}>
                {t('employees.wizard.back')}
              </Button>
            )}
            {isLastStep ? (
              <Button type="primary" loading={isSaving} onClick={handleFinish}>
                {t('employees.wizard.finish')}
              </Button>
            ) : (
              <Button type="primary" onClick={handleNext} disabled={isSaving}>
                {t('employees.wizard.next')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <Steps current={step} items={stepItems} size="small" className={styles.steps} />

      <Form
        form={form}
        layout="vertical"
        requiredMark
        disabled={isSaving}
        initialValues={{
          gender: 'male' as Gender,
          maritalStatus: 'single' as MaritalStatus,
          status: 'probation' as EmployeeStatus,
          withContract: false,
          withAccount: false,
          activateContract: false,
          contractType: 'probation' as ContractTypeValue,
          positionAllowance: 0,
          otherAllowance: 0,
          roleId: 5,
        }}
      >
        {/* ---------------------------------------------------- step 1 --- */}
        <div {...pane(0)}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="lastName"
                label={t('employees.fields.lastName')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <Input placeholder="Nguyễn" maxLength={50} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="firstName"
                label={t('employees.fields.firstName')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <Input placeholder="Văn Bình" maxLength={50} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="dateOfBirth"
                label={t('employees.fields.dateOfBirth')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
                extra={t('employees.validation.ageHint')}
              >
                <DatePicker format="DD/MM/YYYY" className={styles.full} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item name="gender" label={t('employees.fields.gender')}>
                <Select
                  options={GENDERS.map((value) => ({
                    value,
                    label: t(`employees.gender.${value}`),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="maritalStatus" label={t('employees.fields.maritalStatus')}>
                <Select
                  options={MARITAL_STATUSES.map((value) => ({
                    value,
                    label: t(`employees.maritalStatus.${value}`),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="phone"
                label={t('employees.fields.phone')}
                rules={[
                  { required: true, message: t('employees.validation.required') },
                  { pattern: PHONE_PATTERN, message: t('employees.validation.phone') },
                ]}
              >
                <Input placeholder="0912345678" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label={t('employees.fields.email')}
                rules={[
                  { required: true, message: t('employees.validation.required') },
                  { type: 'email', message: t('employees.validation.email') },
                ]}
              >
                <Input placeholder="binh.nguyen@company.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="personalEmail"
                label={t('employees.fields.personalEmail')}
                rules={[{ type: 'email', message: t('employees.validation.email') }]}
              >
                <Input placeholder="binh@gmail.com" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="cccdNumber"
                label={t('employees.fields.cccdNumber')}
                rules={[
                  { required: true, message: t('employees.validation.required') },
                  { pattern: CCCD_PATTERN, message: t('employees.validation.cccd') },
                ]}
              >
                <Input placeholder="001098765432" maxLength={12} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="cccdIssueDate"
                label={t('employees.fields.cccdIssueDate')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <DatePicker format="DD/MM/YYYY" className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="cccdIssuePlace"
                label={t('employees.fields.cccdIssuePlace')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <Input placeholder="Cục CS QLHC về TTXH" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="placeOfBirth"
                label={t('employees.fields.placeOfBirth')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="hometown"
                label={t('employees.fields.hometown')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <Input />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="provinceCode"
                label={t('employees.fields.provinceCode')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                {/* Falls back to a plain code input if the lookup fails, so a
                    broken reference endpoint never blocks creating staff. */}
                {provincesFailed ? (
                  <Input placeholder="01" maxLength={10} />
                ) : (
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder={t('employees.fields.provincePlaceholder')}
                    // Đổi tỉnh thì phường/xã cũ không còn thuộc tỉnh mới.
                    onChange={() => form.setFieldValue('wardCode', undefined)}
                    options={(provinces ?? []).map((province) => ({
                      value: province.code,
                      label: province.name,
                    }))}
                  />
                )}
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item
                name="wardCode"
                label={t('employees.fields.wardCode')}
                rules={[
                  { required: true, message: t('employees.validation.required') },
                  { pattern: AREA_CODE_PATTERN, message: t('employees.validation.areaCode') },
                ]}
                extra={
                  provinceCode === undefined
                    ? t('employees.fields.wardNeedsProvince')
                    : t('employees.fields.twoTierHint')
                }
              >
                {/* Rơi về ô nhập mã khi danh mục lỗi — hỏng một endpoint tra
                    cứu không được chặn việc tạo hồ sơ nhân viên. */}
                {wardsFailed ? (
                  <Input placeholder="10105001" maxLength={10} />
                ) : (
                  <Select
                    showSearch
                    optionFilterProp="label"
                    disabled={provinceCode === undefined}
                    loading={wardsLoading}
                    placeholder={t('employees.fields.wardPlaceholder')}
                    options={(wards ?? []).map((ward) => ({
                      value: ward.code,
                      label: ward.name,
                    }))}
                  />
                )}
              </Form.Item>
            </Col>

            {/* Địa chỉ đi từ ĐƠN VỊ HÀNH CHÍNH LỚN xuống chi tiết:
                tỉnh → xã/phường → thôn/tổ → toà nhà, số nhà, số phòng.
                Hai ô dưới là phần chi tiết, nên phải nằm SAU hai ô trên. */}
            <Col xs={24}>
              <Form.Item
                name="permanentAddress"
                label={t('employees.fields.permanentAddress')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
                extra={t('employees.fields.addressDetailHint')}
              >
                <Input placeholder={t('employees.fields.addressDetailPlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="currentAddress"
                label={t('employees.fields.currentAddress')}
                extra={t('employees.fields.currentAddressHint')}
              >
                <Input placeholder={t('employees.fields.addressDetailPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* ---------------------------------------------------- step 2 --- */}
        <div {...pane(1)}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="departmentId"
                label={t('employees.fields.department')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={t('employees.fields.departmentPlaceholder')}
                  // Changing department invalidates the chosen position.
                  onChange={() => form.setFieldValue('positionId', undefined)}
                  // Indented by depth so the tree's shape survives in a flat
                  // dropdown ("Phòng Kỹ thuật" vs its sub-team of the same name).
                  options={departments.map(({ node, depth }) => ({
                    value: node.id,
                    label: `${'  '.repeat(depth)}${node.name} (${node.code})`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="positionId"
                label={t('employees.fields.position')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
                extra={
                  departmentId === undefined
                    ? t('employees.fields.positionNeedsDepartment')
                    : undefined
                }
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  disabled={departmentId === undefined}
                  loading={positionsResource.isFetching}
                  placeholder={t('employees.fields.positionPlaceholder')}
                  options={positions.map((position) => ({
                    value: position.id,
                    label: `${position.name} (${position.code})`,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="hireDate"
                label={t('employees.fields.hireDate')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <DatePicker format="DD/MM/YYYY" className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="probationStartDate" label={t('employees.fields.probationStart')}>
                <DatePicker format="DD/MM/YYYY" className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="probationEndDate" label={t('employees.fields.probationEnd')}>
                <DatePicker format="DD/MM/YYYY" className={styles.full} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item name="status" label={t('employees.fields.status')}>
                <Select
                  options={(['probation', 'active'] as EmployeeStatus[]).map((value) => ({
                    value,
                    label: t(`employees.status.${value}`),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="educationLevel" label={t('employees.fields.educationLevel')}>
                <Select
                  allowClear
                  options={EDUCATION_LEVELS.map((value) => ({
                    value,
                    label: t(`employees.education.${value}`),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="graduationYear" label={t('employees.fields.graduationYear')}>
                <InputNumber min={1950} max={2100} className={styles.full} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="major" label={t('employees.fields.major')}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="university" label={t('employees.fields.university')}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* ---------------------------------------------------- step 3 --- */}
        <div {...pane(2)}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="bankAccount" label={t('employees.fields.bankAccount')}>
                <Input placeholder="1234567890" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="bankName" label={t('employees.fields.bankName')}>
                <Input placeholder="Vietcombank" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="bankBranch" label={t('employees.fields.bankBranch')}>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Form.Item
            name="withContract"
            label={t('employees.wizard.withContract')}
            valuePropName="checked"
            extra={t('employees.wizard.withContractHint')}
          >
            <Switch />
          </Form.Item>

          {withContract && (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="contractNumber"
                  label={t('employees.fields.contractNumber')}
                  rules={[{ required: true, message: t('employees.validation.required') }]}
                >
                  <Input placeholder="HDLD-2026-001" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="contractType"
                  label={t('employees.fields.contractType')}
                  rules={[{ required: true, message: t('employees.validation.required') }]}
                >
                  <Select
                    options={CONTRACT_TYPES.map((value) => ({
                      value,
                      label: t(`employees.contractType.${value}`),
                    }))}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="signDate"
                  label={t('employees.fields.signDate')}
                  rules={[{ required: true, message: t('employees.validation.required') }]}
                >
                  <DatePicker format="DD/MM/YYYY" className={styles.full} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="contractStartDate"
                  label={t('employees.fields.contractStart')}
                  rules={[{ required: true, message: t('employees.validation.required') }]}
                >
                  <DatePicker format="DD/MM/YYYY" className={styles.full} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="contractEndDate"
                  label={t('employees.fields.contractEnd')}
                  // An indefinite contract must have NO end date; the server
                  // rejects one, so the field is required for every other type.
                  rules={[
                    {
                      required: contractType !== 'indefinite',
                      message: t('employees.validation.required'),
                    },
                  ]}
                  extra={
                    contractType === 'indefinite'
                      ? t('employees.validation.indefiniteNoEnd')
                      : undefined
                  }
                >
                  <DatePicker
                    format="DD/MM/YYYY"
                    className={styles.full}
                    disabled={contractType === 'indefinite'}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="baseSalary"
                  label={t('employees.fields.baseSalary')}
                  rules={[{ required: true, message: t('employees.validation.required') }]}
                >
                  <InputNumber min={0} step={1000000} className={styles.full} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="insuranceSalary"
                  label={t('employees.fields.insuranceSalary')}
                  rules={[{ required: true, message: t('employees.validation.required') }]}
                  extra={t('employees.fields.insuranceSalaryHint')}
                >
                  <InputNumber min={0} step={1000000} className={styles.full} />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item name="positionAllowance" label={t('employees.fields.positionAllowance')}>
                  <InputNumber min={0} step={100000} className={styles.full} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="otherAllowance" label={t('employees.fields.otherAllowance')}>
                  <InputNumber min={0} step={100000} className={styles.full} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="activateContract"
                  label={t('employees.wizard.activateContract')}
                  valuePropName="checked"
                  extra={t('employees.wizard.activateContractHint')}
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
          )}
        </div>

        {/* ---------------------------------------------------- step 4 --- */}
        {canCreateAccount && (
          <div {...pane(3)}>
            <Form.Item
              name="withAccount"
              label={t('employees.wizard.withAccount')}
              valuePropName="checked"
              extra={t('employees.wizard.withAccountHint')}
            >
              <Switch />
            </Form.Item>

            {withAccount && (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="username"
                    label={t('employees.fields.username')}
                    rules={[{ required: true, message: t('employees.validation.required') }]}
                  >
                    <Input placeholder="binh.nguyen" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="accountEmail"
                    label={t('employees.fields.accountEmail')}
                    rules={[{ type: 'email', message: t('employees.validation.email') }]}
                    extra={t('employees.fields.accountEmailHint')}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="password"
                    label={t('employees.fields.tempPassword')}
                    rules={[
                      { required: true, message: t('employees.validation.required') },
                      { min: 8, message: t('employees.validation.password') },
                    ]}
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="roleId"
                    label={t('employees.fields.role')}
                    rules={[{ required: true, message: t('employees.validation.required') }]}
                  >
                    <Select
                      options={(roles ?? []).map((role) => ({
                        value: role.id,
                        label: role.displayName,
                      }))}
                    />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </div>
        )}
      </Form>

      {submitError && (
        <Alert type="error" showIcon message={submitError} className={styles.submitError} />
      )}
    </Modal>
  );
}
