-- =============================================
-- Premium Fund Calculation System
-- =============================================

-- =============================================
-- 1. CREATE PREMIUM CALCULATION TABLES
-- =============================================

-- Employee performance metrics table
CREATE TABLE IF NOT EXISTS employee_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    period_start date NOT NULL,
    period_end date NOT NULL,
    -- Performance criteria
    task_completion_frequency integer DEFAULT 0, -- Частота выполнения задач
    tasks_not_completed_on_time integer DEFAULT 0, -- Количество невыполненных задач в срок
    tasks_completed_on_time integer DEFAULT 0, -- Количество выполненных задач в срок
    total_contract_value numeric DEFAULT 0, -- Общая сумма стоимости всех контрактов
    number_of_delays integer DEFAULT 0, -- Количество опозданий
    -- Calculated fields
    normalized_score numeric DEFAULT 0, -- Нормализованный балл
    premium_amount numeric DEFAULT 0, -- Сумма премии
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Premium fund periods table
CREATE TABLE IF NOT EXISTS premium_funds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_fund_amount numeric NOT NULL, -- Общая сумма премиального фонда
    status text NOT NULL CHECK (status IN ('active', 'calculated', 'distributed')) DEFAULT 'active',
    created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================
-- 2. CREATE CALCULATION FUNCTIONS
-- =============================================

-- Function to calculate normalized score for an employee
CREATE OR REPLACE FUNCTION calculate_employee_score(
    p_user_id uuid,
    p_period_start date,
    p_period_end date
) RETURNS numeric AS $$
DECLARE
    metrics_record employee_metrics%ROWTYPE;
    score numeric := 0;
    -- Criteria weights and signs (based on Excel table)
    -- 1. Частота выполнения задач: weight=1, sign=+1, max=5
    -- 2. Количество невыполненных задач в срок: weight=0.75, sign=-1, max=3  
    -- 3. Количество выполненных задач в срок: weight=1, sign=+1, max=2
    -- 4. Общая сумма стоимости всех контрактов: weight=1, sign=+1, max=650000
    -- 5. Количество опозданий: weight=0.5, sign=-1, max=2
BEGIN
    -- Get employee metrics
    SELECT * INTO metrics_record 
    FROM employee_metrics 
    WHERE user_id = p_user_id 
    AND period_start = p_period_start 
    AND period_end = p_period_end;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Calculate normalized score using additive criterion formula
    -- y = Σ(S_j * W_j * (C_ij / Max_j))
    
    -- 1. Частота выполнения задач (positive, weight=1, max=5)
    score := score + (1.0 * 1.0 * (metrics_record.task_completion_frequency::numeric / 5.0));
    
    -- 2. Количество невыполненных задач в срок (negative, weight=0.75, max=3)
    score := score + (-1.0 * 0.75 * (metrics_record.tasks_not_completed_on_time::numeric / 3.0));
    
    -- 3. Количество выполненных задач в срок (positive, weight=1, max=2)
    score := score + (1.0 * 1.0 * (metrics_record.tasks_completed_on_time::numeric / 2.0));
    
    -- 4. Общая сумма стоимости всех контрактов (positive, weight=1, max=650000)
    score := score + (1.0 * 1.0 * (metrics_record.total_contract_value / 650000.0));
    
    -- 5. Количество опозданий (negative, weight=0.5, max=2)
    score := score + (-1.0 * 0.5 * (metrics_record.number_of_delays::numeric / 2.0));
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate premium distribution
CREATE OR REPLACE FUNCTION calculate_premium_distribution(
    p_fund_id uuid
) RETURNS void AS $$
DECLARE
    fund_record premium_funds%ROWTYPE;
    total_score numeric := 0;
    employee_record RECORD;
    premium_ratio numeric;
BEGIN
    -- Get fund details
    SELECT * INTO fund_record FROM premium_funds WHERE id = p_fund_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Premium fund not found';
    END IF;
    
    -- Calculate total score for all employees in the period
    SELECT COALESCE(SUM(calculate_employee_score(user_id, fund_record.period_start, fund_record.period_end)), 0)
    INTO total_score
    FROM employee_metrics
    WHERE period_start = fund_record.period_start 
    AND period_end = fund_record.period_end;
    
    -- If no scores, exit
    IF total_score = 0 THEN
        RETURN;
    END IF;
    
    -- Update premium amounts for each employee
    FOR employee_record IN 
        SELECT user_id, calculate_employee_score(user_id, fund_record.period_start, fund_record.period_end) as score
        FROM employee_metrics
        WHERE period_start = fund_record.period_start 
        AND period_end = fund_record.period_end
    LOOP
        -- Calculate premium ratio: employee_score / total_score
        premium_ratio := employee_record.score / total_score;
        
        -- Update employee metrics with calculated premium
        UPDATE employee_metrics 
        SET 
            normalized_score = employee_record.score,
            premium_amount = fund_record.total_fund_amount * premium_ratio,
            updated_at = now()
        WHERE user_id = employee_record.user_id 
        AND period_start = fund_record.period_start 
        AND period_end = fund_record.period_end;
    END LOOP;
    
    -- Update fund status
    UPDATE premium_funds 
    SET 
        status = 'calculated',
        updated_at = now()
    WHERE id = p_fund_id;
    
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 3. CREATE RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE employee_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_funds ENABLE ROW LEVEL SECURITY;

-- Employee metrics policies
CREATE POLICY "employee_metrics_select_own" ON employee_metrics FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "employee_metrics_admin_all" ON employee_metrics FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('Администратор', 'Менеджер')
    )
);

-- Premium funds policies
CREATE POLICY "premium_funds_select_admin_manager" ON premium_funds FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('Администратор', 'Менеджер')
    )
);
CREATE POLICY "premium_funds_insert_admin" ON premium_funds FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'Администратор'
    )
);
CREATE POLICY "premium_funds_update_admin" ON premium_funds FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'Администратор'
    )
);

-- =============================================
-- 4. CREATE INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_employee_metrics_user_id ON employee_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_metrics_period ON employee_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_premium_funds_period ON premium_funds(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_premium_funds_status ON premium_funds(status);

SELECT 'Premium system created successfully' as status;

