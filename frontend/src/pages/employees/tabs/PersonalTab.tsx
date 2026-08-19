import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Row,
  Select,
  Space,
  Tooltip,
} from 'antd';
import { EditOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useProvinces, useWards } from '@/hooks/useProvinces';
import {
  EDUCATION_LEVELS,
  GENDERS,
  MARITAL_STATUSES,
  type EducationLevel,
  type EmployeeDetail,
  type Gender,
  type MaritalStatus,
  type UpdateEmployeePayload,
} from '@/types/employee.types';
import { formatDate, formatPhone, maskCccd } from '@/utils/format';
import styles from './tabs.module.css';

/**
 * "Cá nhân" tab — the employee's own record, and the only place the app can
 * EDIT one.
 *
 * Read mode is `Descriptions`; edit mode swaps in a `Form` over the same data.
 * One screen with two modes rather than a separate edit page, because every
 * field a user might want to change is already listed here — sending them
 * somewhere else to change one phone number would only add a navigation step.
 *
 * CCCD IS MASKED BY DEFAULT (`001***876543`) with an explicit reveal button.
 * PLAN §3.2 asks for masking "trong danh sách"; the list response does not carry
 * the number at all (the server omits it, which is stronger), so this detail
 * screen is where the rule actually has something to hide. Revealing is a
 * deliberate act, and the full number never appears in a browsing context.
 */

export interface PersonalTabProps {
  employee: EmployeeDetail;
  canEdit: boolean;
  isSaving: boolean;
  onSave: (payload: UpdateEmployeePayload) => Promise<unknown>;
}

interface PersonalFormValues {
  lastName: string;
  firstName: string;
  dateOfBirth: Dayjs;
  gender: Gender;
  maritalStatus: MaritalStatus;
  nationality?: string;
  ethnicity?: string;
  religion?: string;
  placeOfBirth: string;
  hometown: string;
  phone: string;
  email: string;
  personalEmail?: string;
  permanentAddress: string;
  currentAddress?: string;
  provinceCode: string;
  wardCode: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRel?: string;
  taxCode?: string;
  socialInsuranceNo?: string;
  healthInsuranceNo?: string;
  bankAccount?: string;
  bankName?: string;
  bankBranch?: string;
  educationLevel?: EducationLevel;
  major?: string;
  university?: string;
  graduationYear?: number;
  notes?: string;
}

const PHONE_PATTERN = /^(0\d{9}|\+84\d{9})$/;

/** `''` and `undefined` both mean "clear this nullable column" to the API. */
const orNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function PersonalTab({ employee, canEdit, isSaving, onSave }: PersonalTabProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<PersonalFormValues>();
  const resolveError = useApiErrorMessage();
  const [isEditing, setEditing] = useState(false);
  const [showCccd, setShowCccd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: provinces } = useProvinces();
  const editingProvince = Form.useWatch('provinceCode', form);
  /**
   * Tải kể cả khi KHÔNG sửa: chế độ xem cần tên phường/xã, nếu không màn hình
   * chỉ hiện mã trần "10101003". Cache `staleTime: Infinity` nên mỗi tỉnh chỉ
   * gọi một lần cho cả phiên.
   */
  const { data: wards, isFetching: wardsLoading } = useWards(
    editingProvince ?? employee.provinceCode,
  );

  const provinceName = useMemo(
    () => provinces?.find((province) => province.code === employee.provinceCode)?.name,
    [employee.provinceCode, provinces],
  );
  const wardName = useMemo(
    () => wards?.find((ward) => ward.code === employee.wardCode)?.name,
    [employee.wardCode, wards],
  );

  // Re-seed whenever a different record is shown or edit mode opens, so the
  // form never carries the previous employee's values.
  useEffect(() => {
    if (!isEditing) {
      return;
    }
    form.setFieldsValue({
      lastName: employee.lastName,
      firstName: employee.firstName,
      dateOfBirth: dayjs(employee.dateOfBirth),
      gender: employee.gender,
      maritalStatus: employee.maritalStatus,
      nationality: employee.nationality,
      ethnicity: employee.ethnicity,
      religion: employee.religion ?? undefined,
      placeOfBirth: employee.placeOfBirth,
      hometown: employee.hometown,
      phone: employee.phone,
      email: employee.email,
      personalEmail: employee.personalEmail ?? undefined,
      permanentAddress: employee.permanentAddress,
      currentAddress: employee.currentAddress ?? undefined,
      provinceCode: employee.provinceCode,
      wardCode: employee.wardCode,
      emergencyContactName: employee.emergencyContactName ?? undefined,
      emergencyContactPhone: employee.emergencyContactPhone ?? undefined,
      emergencyContactRel: employee.emergencyContactRel ?? undefined,
      taxCode: employee.taxCode ?? undefined,
      socialInsuranceNo: employee.socialInsuranceNo ?? undefined,
      healthInsuranceNo: employee.healthInsuranceNo ?? undefined,
      bankAccount: employee.bankAccount ?? undefined,
      bankName: employee.bankName ?? undefined,
      bankBranch: employee.bankBranch ?? undefined,
      educationLevel: employee.educationLevel ?? undefined,
      major: employee.major ?? undefined,
      university: employee.university ?? undefined,
      graduationYear: employee.graduationYear ?? undefined,
      notes: employee.notes ?? undefined,
    });
  }, [employee, form, isEditing]);

  const handleSubmit = () => {
    void form.validateFields().then(async (values) => {
      setError(null);
      try {
        await onSave({
          lastName: values.lastName.trim(),
          firstName: values.firstName.trim(),
          dateOfBirth: values.dateOfBirth.format('YYYY-MM-DD'),
          gender: values.gender,
          maritalStatus: values.maritalStatus,
          nationality: values.nationality?.trim() || undefined,
          ethnicity: values.ethnicity?.trim() || undefined,
          religion: orNull(values.religion),
          placeOfBirth: values.placeOfBirth.trim(),
          hometown: values.hometown.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
          personalEmail: orNull(values.personalEmail),
          permanentAddress: values.permanentAddress.trim(),
          currentAddress: orNull(values.currentAddress),
          provinceCode: values.provinceCode,
          // districtCode giữ nguyên giá trị cũ trong DB, form không sửa nó nữa.
          wardCode: values.wardCode,
          emergencyContactName: orNull(values.emergencyContactName),
          emergencyContactPhone: orNull(values.emergencyContactPhone),
          emergencyContactRel: orNull(values.emergencyContactRel),
          taxCode: orNull(values.taxCode),
          socialInsuranceNo: orNull(values.socialInsuranceNo),
          healthInsuranceNo: orNull(values.healthInsuranceNo),
          bankAccount: orNull(values.bankAccount),
          bankName: orNull(values.bankName),
          bankBranch: orNull(values.bankBranch),
          educationLevel: values.educationLevel ?? null,
          major: orNull(values.major),
          university: orNull(values.university),
          graduationYear: values.graduationYear ?? null,
          notes: orNull(values.notes),
        });
        setEditing(false);
      } catch (submitError) {
        // Dịch từ `error.code`, KHÔNG bao giờ render `error.message` của
        // backend — đó là text tiếng Anh cho developer/log (api-spec.md §1.1).
        setError(resolveError(submitError));
      }
    });
  };

  // ------------------------------------------------------------ read ---

  if (!isEditing) {
    const item = (label: string, value: React.ReactNode) => ({
      key: label,
      label,
      children: value ?? <span className={styles.muted}>—</span>,
    });

    return (
      <div>
        {canEdit && (
          <div className={styles.toolbar}>
            <span />
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
              {t('employees.detail.edit')}
            </Button>
          </div>
        )}

        <p className={styles.sectionTitle}>{t('employees.detail.sectionPersonal')}</p>
        <Descriptions bordered column={{ xs: 1, sm: 2, xl: 3 }} size="small">
          {[
            item(t('employees.fields.lastName'), employee.lastName),
            item(t('employees.fields.firstName'), employee.firstName),
            item(t('employees.fields.dateOfBirth'), formatDate(employee.dateOfBirth)),
            item(t('employees.fields.gender'), t(`employees.gender.${employee.gender}`)),
            item(
              t('employees.fields.maritalStatus'),
              t(`employees.maritalStatus.${employee.maritalStatus}`),
            ),
            item(t('employees.fields.nationality'), employee.nationality),
            item(t('employees.fields.ethnicity'), employee.ethnicity),
            item(t('employees.fields.religion'), employee.religion),
            item(t('employees.fields.placeOfBirth'), employee.placeOfBirth),
            item(t('employees.fields.hometown'), employee.hometown),
          ].map((entry) => (
            <Descriptions.Item key={entry.key} label={entry.label}>
              {entry.children}
            </Descriptions.Item>
          ))}
        </Descriptions>

        <p className={styles.sectionTitle}>{t('employees.detail.sectionIdentity')}</p>
        <Descriptions bordered column={{ xs: 1, sm: 2, xl: 3 }} size="small">
          <Descriptions.Item label={t('employees.fields.cccdNumber')}>
            <span className={styles.revealRow}>
              <span className={styles.mono}>
                {showCccd ? employee.cccdNumber : maskCccd(employee.cccdNumber)}
              </span>
              <Tooltip title={showCccd ? t('employees.detail.hideCccd') : t('employees.detail.showCccd')}>
                <Button
                  type="text"
                  size="small"
                  icon={showCccd ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  onClick={() => setShowCccd((shown) => !shown)}
                  aria-label={
                    showCccd ? t('employees.detail.hideCccd') : t('employees.detail.showCccd')
                  }
                />
              </Tooltip>
            </span>
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.cccdIssueDate')}>
            {formatDate(employee.cccdIssueDate)}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.cccdIssuePlace')}>
            {employee.cccdIssuePlace}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.taxCode')}>
            {employee.taxCode ?? <span className={styles.muted}>—</span>}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.socialInsuranceNo')}>
            {employee.socialInsuranceNo ?? <span className={styles.muted}>—</span>}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.healthInsuranceNo')}>
            {employee.healthInsuranceNo ?? <span className={styles.muted}>—</span>}
          </Descriptions.Item>
        </Descriptions>

        <p className={styles.sectionTitle}>{t('employees.detail.sectionContact')}</p>
        <Descriptions bordered column={{ xs: 1, sm: 2, xl: 3 }} size="small">
          <Descriptions.Item label={t('employees.fields.phone')}>
            <span className={styles.mono}>{formatPhone(employee.phone)}</span>
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.email')}>{employee.email}</Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.personalEmail')}>
            {employee.personalEmail ?? <span className={styles.muted}>—</span>}
          </Descriptions.Item>
          {/* Địa chỉ đọc từ LỚN xuống NHỎ — tỉnh → xã/phường → chi tiết —
              cùng thứ tự với form nhập, để mắt không phải nhảy ngược. */}
          <Descriptions.Item label={t('employees.fields.provinceCode')}>
            {provinceName ?? employee.provinceCode}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.wardCode')}>
            {wardName ?? employee.wardCode}
          </Descriptions.Item>
          {/* Chỉ hiện với hồ sơ tuyển TRƯỚC 01/07/2025 — hồ sơ mới không có
              cấp huyện, in một dòng trống chỉ làm người đọc bối rối. */}
          {employee.districtCode && (
            <Descriptions.Item label={t('employees.fields.legacyDistrict')}>
              <span className={styles.mono}>{employee.districtCode}</span>
            </Descriptions.Item>
          )}
          <Descriptions.Item label={t('employees.fields.permanentAddress')} span={3}>
            {employee.permanentAddress}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.currentAddress')} span={3}>
            {employee.currentAddress ?? (
              <span className={styles.muted}>{t('employees.fields.sameAsPermanent')}</span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.emergencyContact')} span={3}>
            {employee.emergencyContactName ? (
              <>
                {employee.emergencyContactName}
                {employee.emergencyContactRel ? ` (${employee.emergencyContactRel})` : ''}
                {employee.emergencyContactPhone
                  ? ` · ${formatPhone(employee.emergencyContactPhone)}`
                  : ''}
              </>
            ) : (
              <span className={styles.muted}>—</span>
            )}
          </Descriptions.Item>
        </Descriptions>

        <p className={styles.sectionTitle}>{t('employees.detail.sectionBank')}</p>
        <Descriptions bordered column={{ xs: 1, sm: 2, xl: 3 }} size="small">
          <Descriptions.Item label={t('employees.fields.bankAccount')}>
            <span className={styles.mono}>
              {employee.bankAccount ?? <span className={styles.muted}>—</span>}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.bankName')}>
            {employee.bankName ?? <span className={styles.muted}>—</span>}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.bankBranch')}>
            {employee.bankBranch ?? <span className={styles.muted}>—</span>}
          </Descriptions.Item>
        </Descriptions>

        <p className={styles.sectionTitle}>{t('employees.detail.sectionEducation')}</p>
        <Descriptions bordered column={{ xs: 1, sm: 2, xl: 3 }} size="small">
          <Descriptions.Item label={t('employees.fields.educationLevel')}>
            {employee.educationLevel ? (
              t(`employees.education.${employee.educationLevel}`)
            ) : (
              <span className={styles.muted}>—</span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.major')}>
            {employee.major ?? <span className={styles.muted}>—</span>}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.university')}>
            {employee.university ?? <span className={styles.muted}>—</span>}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.graduationYear')}>
            {employee.graduationYear ?? <span className={styles.muted}>—</span>}
          </Descriptions.Item>
          <Descriptions.Item label={t('employees.fields.notes')} span={2}>
            {employee.notes ?? <span className={styles.muted}>—</span>}
          </Descriptions.Item>
        </Descriptions>
      </div>
    );
  }

  // ------------------------------------------------------------ edit ---

  return (
    <Form form={form} layout="vertical" disabled={isSaving}>
      <div className={styles.toolbar}>
        <span />
        <Space>
          <Button onClick={() => setEditing(false)} disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" loading={isSaving} onClick={handleSubmit}>
            {t('common.save')}
          </Button>
        </Space>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <p className={styles.sectionTitle}>{t('employees.detail.sectionPersonal')}</p>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            name="lastName"
            label={t('employees.fields.lastName')}
            rules={[{ required: true, message: t('employees.validation.required') }]}
          >
            <Input maxLength={50} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="firstName"
            label={t('employees.fields.firstName')}
            rules={[{ required: true, message: t('employees.validation.required') }]}
          >
            <Input maxLength={50} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="dateOfBirth"
            label={t('employees.fields.dateOfBirth')}
            rules={[{ required: true, message: t('employees.validation.required') }]}
          >
            <DatePicker format="DD/MM/YYYY" className={styles.full} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="gender" label={t('employees.fields.gender')}>
            <Select
              options={GENDERS.map((value) => ({ value, label: t(`employees.gender.${value}`) }))}
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
          <Form.Item name="religion" label={t('employees.fields.religion')}>
            <Input maxLength={50} />
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
      </Row>

      <p className={styles.sectionTitle}>{t('employees.detail.sectionContact')}</p>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            name="phone"
            label={t('employees.fields.phone')}
            rules={[
              { required: true, message: t('employees.validation.required') },
              { pattern: PHONE_PATTERN, message: t('employees.validation.phone') },
            ]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="email"
            label={t('employees.fields.email')}
            rules={[
              { required: true, message: t('employees.validation.required') },
              { type: 'email', message: t('employees.validation.email') },
            ]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="personalEmail"
            label={t('employees.fields.personalEmail')}
            rules={[{ type: 'email', message: t('employees.validation.email') }]}
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
            <Select
              showSearch
              optionFilterProp="label"
              // Đổi tỉnh thì phường/xã cũ không còn thuộc tỉnh mới.
              onChange={() => form.setFieldValue('wardCode', undefined)}
              options={(provinces ?? []).map((province) => ({
                value: province.code,
                label: province.name,
              }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={16}>
          <Form.Item
            name="wardCode"
            label={t('employees.fields.wardCode')}
            rules={[{ required: true, message: t('employees.validation.required') }]}
            extra={t('employees.fields.twoTierHint')}
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={wardsLoading}
              placeholder={t('employees.fields.wardPlaceholder')}
              options={(wards ?? []).map((ward) => ({
                value: ward.code,
                label: ward.name,
              }))}
            />
          </Form.Item>
        </Col>

        {/* Chi tiết đứng SAU đơn vị hành chính: tỉnh → xã/phường → thôn/tổ →
            toà nhà, số nhà, số phòng. */}
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
          <Form.Item name="currentAddress" label={t('employees.fields.currentAddress')}>
            <Input placeholder={t('employees.fields.addressDetailPlaceholder')} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="emergencyContactName" label={t('employees.fields.emergencyName')}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="emergencyContactPhone"
            label={t('employees.fields.emergencyPhone')}
            rules={[{ pattern: PHONE_PATTERN, message: t('employees.validation.phone') }]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="emergencyContactRel" label={t('employees.fields.emergencyRel')}>
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <p className={styles.sectionTitle}>{t('employees.detail.sectionIdentity')}</p>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item name="taxCode" label={t('employees.fields.taxCode')}>
            <Input maxLength={13} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="socialInsuranceNo" label={t('employees.fields.socialInsuranceNo')}>
            <Input maxLength={10} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="healthInsuranceNo" label={t('employees.fields.healthInsuranceNo')}>
            <Input maxLength={15} />
          </Form.Item>
        </Col>
      </Row>

      <p className={styles.sectionTitle}>{t('employees.detail.sectionBank')}</p>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item name="bankAccount" label={t('employees.fields.bankAccount')}>
            <Input maxLength={30} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="bankName" label={t('employees.fields.bankName')}>
            <Input maxLength={100} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="bankBranch" label={t('employees.fields.bankBranch')}>
            <Input maxLength={200} />
          </Form.Item>
        </Col>
      </Row>

      <p className={styles.sectionTitle}>{t('employees.detail.sectionEducation')}</p>
      <Row gutter={16}>
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
          <Form.Item name="major" label={t('employees.fields.major')}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="university" label={t('employees.fields.university')}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item name="notes" label={t('employees.fields.notes')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
}
