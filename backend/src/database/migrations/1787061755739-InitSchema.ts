import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration that creates all 26 tables in the exact order defined in
 * docs/database-schema.md §"Migration Order" (to avoid FK constraint errors).
 *
 * Written by hand (raw SQL) instead of using `migration:generate` because of
 * several self-references (departments.parent_id, employees.direct_manager_id)
 * and circular FKs (departments <-> employees, users <-> employees) that
 * require precise control over table creation order and when constraints
 * are added.
 *
 * Important note (deviation from the docs):
 *   - `departments.manager_id -> employees.id`: the column is created in
 *     step 6, but the FK constraint is only added via ALTER once the
 *     `employees` table exists (step 8) — as described in the docs.
 *   - `users.employee_id -> employees.id`: the docs do NOT mention this
 *     case, but it is a similar circular FK (users is created in step 4,
 *     employees in step 8). The same technique is applied: create the
 *     column in step 4, then ALTER to add the FK once employees exists.
 */
export class InitSchema1787061755739 implements MigrationInterface {
  name = 'InitSchema1787061755739';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const charset =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

    // 1. roles
    await queryRunner.query(`
      CREATE TABLE roles (
        id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_roles_name (name)
      ) ${charset};
    `);

    // 2. permissions
    await queryRunner.query(`
      CREATE TABLE permissions (
        id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        module VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        UNIQUE KEY uq_permissions_name (name)
      ) ${charset};
    `);

    // 3. role_permissions
    await queryRunner.query(`
      CREATE TABLE role_permissions (
        role_id TINYINT UNSIGNED NOT NULL,
        permission_id SMALLINT UNSIGNED NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ${charset};
    `);

    // 4. users (employee_id: no FK yet; added later once the employees table exists)
    await queryRunner.query(`
      CREATE TABLE users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role_id TINYINT UNSIGNED NOT NULL DEFAULT 5,
        employee_id BIGINT UNSIGNED NULL,
        status ENUM('active','inactive','locked') NOT NULL DEFAULT 'active',
        last_login_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        UNIQUE KEY uq_users_username (username),
        UNIQUE KEY uq_users_email (email),
        UNIQUE KEY uq_users_employee_id (employee_id),
        CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
      ) ${charset};
    `);

    // 5. refresh_tokens
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        device VARCHAR(255) NULL,
        ip_address VARCHAR(45) NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_refresh_tokens_hash (token_hash),
        CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ${charset};
    `);

    // 6. departments (manager_id: no FK yet; added later once the employees table exists)
    await queryRunner.query(`
      CREATE TABLE departments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(150) NOT NULL,
        description TEXT NULL,
        parent_id BIGINT UNSIGNED NULL,
        manager_id BIGINT UNSIGNED NULL,
        sort_order SMALLINT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        UNIQUE KEY uq_departments_code (code),
        CONSTRAINT fk_departments_parent FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL
      ) ${charset};
    `);

    // 7. positions
    await queryRunner.query(`
      CREATE TABLE positions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(150) NOT NULL,
        department_id BIGINT UNSIGNED NOT NULL,
        level SMALLINT NOT NULL,
        min_salary DECIMAL(15,2) NULL,
        max_salary DECIMAL(15,2) NULL,
        description TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        UNIQUE KEY uq_positions_code (code),
        CONSTRAINT fk_positions_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
      ) ${charset};
    `);

    // 8. employees (central table)
    await queryRunner.query(`
      CREATE TABLE employees (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_code VARCHAR(20) NOT NULL,

        last_name VARCHAR(50) NOT NULL,
        first_name VARCHAR(50) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        date_of_birth DATE NOT NULL,
        gender ENUM('male','female','other') NOT NULL,
        marital_status ENUM('single','married','divorced','widowed') NOT NULL DEFAULT 'single',
        nationality VARCHAR(50) NOT NULL DEFAULT 'Việt Nam',
        ethnicity VARCHAR(50) NOT NULL DEFAULT 'Kinh',
        religion VARCHAR(50) NULL,
        place_of_birth VARCHAR(255) NOT NULL,
        hometown VARCHAR(255) NOT NULL,

        cccd_number VARCHAR(12) NOT NULL,
        cccd_issue_date DATE NOT NULL,
        cccd_issue_place VARCHAR(255) NOT NULL,
        cccd_expired_date DATE NULL,

        tax_code VARCHAR(13) NULL,
        social_insurance_no VARCHAR(15) NULL,
        health_insurance_no VARCHAR(15) NULL,
        health_insurance_exp DATE NULL,

        permanent_address VARCHAR(500) NOT NULL,
        current_address VARCHAR(500) NULL,
        province_code VARCHAR(10) NOT NULL,
        district_code VARCHAR(10) NOT NULL,
        ward_code VARCHAR(10) NOT NULL,

        phone VARCHAR(15) NOT NULL,
        email VARCHAR(100) NOT NULL,
        personal_email VARCHAR(100) NULL,
        emergency_contact_name VARCHAR(100) NULL,
        emergency_contact_phone VARCHAR(15) NULL,
        emergency_contact_rel VARCHAR(50) NULL,

        bank_account VARCHAR(30) NULL,
        bank_name VARCHAR(100) NULL,
        bank_branch VARCHAR(200) NULL,

        position_id BIGINT UNSIGNED NOT NULL,
        department_id BIGINT UNSIGNED NOT NULL,
        direct_manager_id BIGINT UNSIGNED NULL,
        hire_date DATE NOT NULL,
        probation_start_date DATE NULL,
        probation_end_date DATE NULL,
        official_start_date DATE NULL,
        termination_date DATE NULL,
        termination_reason TEXT NULL,
        termination_type ENUM('resigned','fired','contract_ended','retired','deceased') NULL,
        status ENUM('probation','active','on_leave','suspended','resigned','terminated') NOT NULL DEFAULT 'probation',

        education_level ENUM('high_school','college','university','master','phd','other') NULL,
        major VARCHAR(200) NULL,
        university VARCHAR(200) NULL,
        graduation_year SMALLINT NULL,

        avatar_url VARCHAR(500) NULL,
        notes TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,

        UNIQUE KEY uq_employees_code (employee_code),
        UNIQUE KEY uq_employees_cccd (cccd_number),
        UNIQUE KEY uq_employees_tax_code (tax_code),
        UNIQUE KEY uq_employees_si_no (social_insurance_no),
        UNIQUE KEY uq_employees_hi_no (health_insurance_no),
        UNIQUE KEY uq_employees_email (email),

        CONSTRAINT fk_employees_position FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE RESTRICT,
        CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
        CONSTRAINT fk_employees_manager FOREIGN KEY (direct_manager_id) REFERENCES employees(id) ON DELETE SET NULL,
        CONSTRAINT fk_employees_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ${charset};
    `);

    // After step 8: add FK departments.manager_id -> employees.id (as described in the docs)
    await queryRunner.query(`
      ALTER TABLE departments
      ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;
    `);

    // Necessary deviation: add FK users.employee_id -> employees.id (circular
    // FK similar to departments.manager_id; not mentioned in the docs but must be handled).
    await queryRunner.query(`
      ALTER TABLE users
      ADD CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
    `);

    // 9. family_members
    await queryRunner.query(`
      CREATE TABLE family_members (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        relationship ENUM('spouse','father','mother','child','sibling','other') NOT NULL,
        date_of_birth DATE NULL,
        occupation VARCHAR(100) NULL,
        phone VARCHAR(15) NULL,
        cccd_number VARCHAR(12) NULL,
        note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_family_members_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      ) ${charset};
    `);

    // 10. dependents
    await queryRunner.query(`
      CREATE TABLE dependents (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        relationship ENUM('child','spouse','parent','sibling','other') NOT NULL,
        date_of_birth DATE NOT NULL,
        cccd_number VARCHAR(12) NULL,
        tax_code VARCHAR(13) NULL,
        registration_date DATE NOT NULL,
        end_date DATE NULL,
        status ENUM('active','inactive') NOT NULL DEFAULT 'active',
        reason_inactive VARCHAR(255) NULL,
        document_url VARCHAR(500) NULL,
        note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_dependents_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      ) ${charset};
    `);

    // 11. contracts
    await queryRunner.query(`
      CREATE TABLE contracts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        contract_number VARCHAR(50) NOT NULL,
        contract_type ENUM('probation','fixed_term','indefinite','seasonal') NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NULL,
        sign_date DATE NOT NULL,
        base_salary DECIMAL(15,2) NOT NULL,
        insurance_salary DECIMAL(15,2) NOT NULL,
        position_allowance DECIMAL(15,2) NOT NULL DEFAULT 0,
        other_allowance DECIMAL(15,2) NOT NULL DEFAULT 0,
        working_hours DECIMAL(4,2) NOT NULL DEFAULT 8.0,
        working_days SMALLINT NOT NULL DEFAULT 5,
        probation_salary_pct DECIMAL(5,2) NULL DEFAULT 85.0,
        status ENUM('draft','active','expired','terminated') NOT NULL DEFAULT 'draft',
        terminated_date DATE NULL,
        terminated_reason TEXT NULL,
        file_url VARCHAR(500) NULL,
        note TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_contracts_number (contract_number),
        CONSTRAINT fk_contracts_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_contracts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ${charset};
    `);

    // 12. leave_types
    await queryRunner.query(`
      CREATE TABLE leave_types (
        id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        days_per_year DECIMAL(5,1) NOT NULL,
        is_paid BOOLEAN NOT NULL DEFAULT TRUE,
        require_approval BOOLEAN NOT NULL DEFAULT TRUE,
        min_days DECIMAL(4,1) NOT NULL DEFAULT 0.5,
        max_consecutive SMALLINT NULL,
        advance_notice_days SMALLINT NOT NULL DEFAULT 1,
        applicable_gender ENUM('all','female','male') NOT NULL DEFAULT 'all',
        description TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order SMALLINT NOT NULL DEFAULT 0,
        UNIQUE KEY uq_leave_types_code (code)
      ) ${charset};
    `);

    // 13. holidays
    await queryRunner.query(`
      CREATE TABLE holidays (
        id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        holiday_date DATE NOT NULL,
        type ENUM('national','company','other') NOT NULL DEFAULT 'national',
        year SMALLINT NOT NULL,
        is_paid BOOLEAN NOT NULL DEFAULT TRUE,
        note VARCHAR(255) NULL,
        UNIQUE KEY uq_holidays_date (holiday_date)
      ) ${charset};
    `);

    // 14. leave_requests
    await queryRunner.query(`
      CREATE TABLE leave_requests (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        leave_type_id TINYINT UNSIGNED NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        start_half ENUM('full','morning','afternoon') NOT NULL DEFAULT 'full',
        end_half ENUM('full','morning','afternoon') NOT NULL DEFAULT 'full',
        total_days DECIMAL(5,1) NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
        approved_by BIGINT UNSIGNED NULL,
        approved_at TIMESTAMP NULL,
        rejected_reason TEXT NULL,
        attachment_url VARCHAR(500) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_leave_requests_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_leave_requests_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
        CONSTRAINT fk_leave_requests_approver FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL
      ) ${charset};
    `);

    // 15. leave_balances (remaining_days = VIRTUAL GENERATED COLUMN)
    await queryRunner.query(`
      CREATE TABLE leave_balances (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        leave_type_id TINYINT UNSIGNED NOT NULL,
        year SMALLINT NOT NULL,
        allocated_days DECIMAL(5,1) NOT NULL,
        used_days DECIMAL(5,1) NOT NULL DEFAULT 0,
        pending_days DECIMAL(5,1) NOT NULL DEFAULT 0,
        carried_over DECIMAL(5,1) NOT NULL DEFAULT 0,
        remaining_days DECIMAL(6,1) GENERATED ALWAYS AS (allocated_days + carried_over - used_days - pending_days) VIRTUAL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_leave_balance_employee_type_year (employee_id, leave_type_id, year),
        CONSTRAINT fk_leave_balances_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_leave_balances_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT
      ) ${charset};
    `);

    // 16. attendances
    await queryRunner.query(`
      CREATE TABLE attendances (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        work_date DATE NOT NULL,
        check_in TIME NULL,
        check_out TIME NULL,
        work_hours DECIMAL(4,2) NULL,
        overtime_hours DECIMAL(4,2) NOT NULL DEFAULT 0,
        is_late BOOLEAN NOT NULL DEFAULT FALSE,
        late_minutes SMALLINT NOT NULL DEFAULT 0,
        is_early_leave BOOLEAN NOT NULL DEFAULT FALSE,
        early_leave_minutes SMALLINT NOT NULL DEFAULT 0,
        status ENUM('present','absent','late','early_leave','leave','holiday','wfh') NOT NULL DEFAULT 'present',
        leave_request_id BIGINT UNSIGNED NULL,
        note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_attendance_employee_date (employee_id, work_date),
        CONSTRAINT fk_attendances_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_attendances_leave_request FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE SET NULL
      ) ${charset};
    `);

    // 17. salaries
    await queryRunner.query(`
      CREATE TABLE salaries (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        month SMALLINT NOT NULL,
        year SMALLINT NOT NULL,

        standard_working_days DECIMAL(4,1) NOT NULL,
        actual_working_days DECIMAL(4,1) NOT NULL DEFAULT 0,
        paid_leave_days DECIMAL(4,1) NOT NULL DEFAULT 0,
        unpaid_leave_days DECIMAL(4,1) NOT NULL DEFAULT 0,
        overtime_hours DECIMAL(5,1) NOT NULL DEFAULT 0,

        base_salary DECIMAL(15,2) NOT NULL,
        position_allowance DECIMAL(15,2) NOT NULL DEFAULT 0,
        attendance_allowance DECIMAL(15,2) NOT NULL DEFAULT 0,
        meal_allowance DECIMAL(15,2) NOT NULL DEFAULT 0,
        transport_allowance DECIMAL(15,2) NOT NULL DEFAULT 0,
        phone_allowance DECIMAL(15,2) NOT NULL DEFAULT 0,
        other_allowances DECIMAL(15,2) NOT NULL DEFAULT 0,
        overtime_pay DECIMAL(15,2) NOT NULL DEFAULT 0,
        performance_bonus DECIMAL(15,2) NOT NULL DEFAULT 0,
        other_income DECIMAL(15,2) NOT NULL DEFAULT 0,
        gross_salary DECIMAL(15,2) NOT NULL,

        insurance_base_salary DECIMAL(15,2) NOT NULL,
        social_insurance DECIMAL(15,2) NOT NULL DEFAULT 0,
        health_insurance DECIMAL(15,2) NOT NULL DEFAULT 0,
        unemployment_insurance DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_insurance DECIMAL(15,2) NOT NULL DEFAULT 0,

        dependent_count SMALLINT NOT NULL DEFAULT 0,
        self_deduction DECIMAL(15,2) NOT NULL DEFAULT 11000000,
        dependent_deduction DECIMAL(15,2) NOT NULL DEFAULT 0,
        taxable_income DECIMAL(15,2) NOT NULL DEFAULT 0,
        personal_income_tax DECIMAL(15,2) NOT NULL DEFAULT 0,

        advance_deduction DECIMAL(15,2) NOT NULL DEFAULT 0,
        other_deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
        net_salary DECIMAL(15,2) NOT NULL,

        status ENUM('draft','calculated','approved','paid','cancelled') NOT NULL DEFAULT 'draft',
        note TEXT NULL,
        approved_by BIGINT UNSIGNED NULL,
        approved_at TIMESTAMP NULL,
        paid_at TIMESTAMP NULL,
        generated_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_salary_employee_month_year (employee_id, month, year),
        CONSTRAINT fk_salaries_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_salaries_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_salaries_generator FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ${charset};
    `);

    // 18. salary_components
    await queryRunner.query(`
      CREATE TABLE salary_components (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        salary_id BIGINT UNSIGNED NOT NULL,
        type ENUM('allowance','bonus','deduction','other') NOT NULL,
        name VARCHAR(100) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        is_taxable BOOLEAN NOT NULL DEFAULT FALSE,
        note VARCHAR(255) NULL,
        CONSTRAINT fk_salary_components_salary FOREIGN KEY (salary_id) REFERENCES salaries(id) ON DELETE CASCADE
      ) ${charset};
    `);

    // 19. trainings
    await queryRunner.query(`
      CREATE TABLE trainings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(30) NOT NULL,
        name VARCHAR(200) NOT NULL,
        type ENUM('internal','external','online','on_the_job') NOT NULL,
        description TEXT NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        location VARCHAR(200) NULL,
        trainer VARCHAR(200) NULL,
        cost DECIMAL(15,2) NOT NULL DEFAULT 0,
        max_participants SMALLINT NULL,
        status ENUM('planned','ongoing','completed','cancelled') NOT NULL DEFAULT 'planned',
        attachment_url VARCHAR(500) NULL,
        note TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_trainings_code (code),
        CONSTRAINT fk_trainings_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ${charset};
    `);

    // 20. employee_trainings
    await queryRunner.query(`
      CREATE TABLE employee_trainings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        training_id BIGINT UNSIGNED NOT NULL,
        registration_date DATE NOT NULL,
        completion_date DATE NULL,
        result ENUM('passed','failed','incomplete','exempted') NULL,
        score DECIMAL(5,2) NULL,
        certificate_url VARCHAR(500) NULL,
        note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_employee_training (employee_id, training_id),
        CONSTRAINT fk_employee_trainings_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_employee_trainings_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
      ) ${charset};
    `);

    // 21. performance_reviews
    await queryRunner.query(`
      CREATE TABLE performance_reviews (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        reviewer_id BIGINT UNSIGNED NOT NULL,
        review_period ENUM('monthly','quarterly','biannual','annual') NOT NULL,
        period_year SMALLINT NOT NULL,
        period_quarter SMALLINT NULL,
        period_month SMALLINT NULL,
        kpi_score DECIMAL(5,2) NULL,
        attitude_score DECIMAL(5,2) NULL,
        skill_score DECIMAL(5,2) NULL,
        overall_score DECIMAL(5,2) NULL,
        rating ENUM('excellent','good','average','below_average','poor') NULL,
        strengths TEXT NULL,
        weaknesses TEXT NULL,
        recommendations TEXT NULL,
        status ENUM('draft','submitted','acknowledged') NOT NULL DEFAULT 'draft',
        acknowledged_at TIMESTAMP NULL,
        note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_performance_reviews_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_performance_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES employees(id) ON DELETE RESTRICT
      ) ${charset};
    `);

    // 22. disciplines_rewards
    await queryRunner.query(`
      CREATE TABLE disciplines_rewards (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        type ENUM('reward','discipline') NOT NULL,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        decision_number VARCHAR(50) NULL,
        decision_date DATE NOT NULL,
        effective_date DATE NOT NULL,
        amount DECIMAL(15,2) NULL,
        issued_by BIGINT UNSIGNED NULL,
        document_url VARCHAR(500) NULL,
        note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_disc_rewards_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_disc_rewards_issuer FOREIGN KEY (issued_by) REFERENCES employees(id) ON DELETE SET NULL
      ) ${charset};
    `);

    // 23. work_history (INSERT only, never UPDATE)
    await queryRunner.query(`
      CREATE TABLE work_history (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        event_type ENUM('hire','promotion','demotion','transfer','salary_change','contract_renew','return_from_leave','termination') NOT NULL,
        from_department_id BIGINT UNSIGNED NULL,
        to_department_id BIGINT UNSIGNED NULL,
        from_position_id BIGINT UNSIGNED NULL,
        to_position_id BIGINT UNSIGNED NULL,
        from_salary DECIMAL(15,2) NULL,
        to_salary DECIMAL(15,2) NULL,
        effective_date DATE NOT NULL,
        reason TEXT NULL,
        decision_number VARCHAR(50) NULL,
        document_url VARCHAR(500) NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_work_history_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_work_history_from_dept FOREIGN KEY (from_department_id) REFERENCES departments(id) ON DELETE SET NULL,
        CONSTRAINT fk_work_history_to_dept FOREIGN KEY (to_department_id) REFERENCES departments(id) ON DELETE SET NULL,
        CONSTRAINT fk_work_history_from_pos FOREIGN KEY (from_position_id) REFERENCES positions(id) ON DELETE SET NULL,
        CONSTRAINT fk_work_history_to_pos FOREIGN KEY (to_position_id) REFERENCES positions(id) ON DELETE SET NULL,
        CONSTRAINT fk_work_history_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ${charset};
    `);

    // 24. documents
    await queryRunner.query(`
      CREATE TABLE documents (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        type ENUM('cccd','cv','degree','contract','health_check','background','photo_3x4','family_book','resignation','other') NOT NULL,
        name VARCHAR(200) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        file_size INT UNSIGNED NULL,
        mime_type VARCHAR(100) NULL,
        issue_date DATE NULL,
        expiry_date DATE NULL,
        note VARCHAR(255) NULL,
        uploaded_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_documents_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_documents_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
      ) ${charset};
    `);

    // 25. announcements
    await queryRunner.query(`
      CREATE TABLE announcements (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        type ENUM('general','policy','event','urgent') NOT NULL DEFAULT 'general',
        target_audience ENUM('all','department','role','individual') NOT NULL DEFAULT 'all',
        target_ids JSON NULL,
        publish_date TIMESTAMP NULL,
        expiry_date TIMESTAMP NULL,
        is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        attachment_url VARCHAR(500) NULL,
        created_by BIGINT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_announcements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
      ) ${charset};
    `);

    // 26. audit_logs (INSERT only; retained for at least 2 years)
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NULL,
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id BIGINT NULL,
        old_values JSON NULL,
        new_values JSON NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(500) NULL,
        description TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ${charset};
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS announcements;`);
    await queryRunner.query(`DROP TABLE IF EXISTS documents;`);
    await queryRunner.query(`DROP TABLE IF EXISTS work_history;`);
    await queryRunner.query(`DROP TABLE IF EXISTS disciplines_rewards;`);
    await queryRunner.query(`DROP TABLE IF EXISTS performance_reviews;`);
    await queryRunner.query(`DROP TABLE IF EXISTS employee_trainings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS trainings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS salary_components;`);
    await queryRunner.query(`DROP TABLE IF EXISTS salaries;`);
    await queryRunner.query(`DROP TABLE IF EXISTS attendances;`);
    await queryRunner.query(`DROP TABLE IF EXISTS leave_balances;`);
    await queryRunner.query(`DROP TABLE IF EXISTS leave_requests;`);
    await queryRunner.query(`DROP TABLE IF EXISTS holidays;`);
    await queryRunner.query(`DROP TABLE IF EXISTS leave_types;`);
    await queryRunner.query(`DROP TABLE IF EXISTS contracts;`);
    await queryRunner.query(`DROP TABLE IF EXISTS dependents;`);
    await queryRunner.query(`DROP TABLE IF EXISTS family_members;`);

    // Remove the 2 deferred FKs before dropping employees
    await queryRunner.query(
      `ALTER TABLE departments DROP FOREIGN KEY fk_dept_manager;`,
    );
    await queryRunner.query(
      `ALTER TABLE users DROP FOREIGN KEY fk_users_employee;`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS employees;`);
    await queryRunner.query(`DROP TABLE IF EXISTS positions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS departments;`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
    await queryRunner.query(`DROP TABLE IF EXISTS role_permissions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS permissions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles;`);
  }
}
