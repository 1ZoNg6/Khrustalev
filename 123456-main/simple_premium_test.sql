-- =============================================
-- Simple Premium Calculation Test
-- =============================================
-- Упрощенный тест системы расчета премий

-- =============================================
-- 1. CREATE TEST DATA DIRECTLY
-- =============================================

-- Создаем тестовый премиальный фонд
INSERT INTO premium_funds (period_start, period_end, total_fund_amount, created_by)
VALUES (
    '2024-01-01'::date,
    '2024-01-31'::date,
    100000, -- 100,000 рублей
    (SELECT id FROM profiles LIMIT 1) -- Берем первого пользователя
) ON CONFLICT DO NOTHING;

-- =============================================
-- 2. INSERT TEST METRICS FOR EXISTING USERS
-- =============================================

-- Получаем первых двух пользователей для тестирования
WITH test_users AS (
    SELECT id, full_name, ROW_NUMBER() OVER (ORDER BY created_at) as rn
    FROM profiles 
    WHERE role = 'Работник'
    LIMIT 2
)
INSERT INTO employee_metrics (
    user_id,
    period_start,
    period_end,
    task_completion_frequency,
    tasks_not_completed_on_time,
    tasks_completed_on_time,
    total_contract_value,
    number_of_delays
)
SELECT 
    id,
    '2024-01-01'::date,
    '2024-01-31'::date,
    CASE 
        WHEN rn = 1 THEN 4  -- Сотрудник A: частота = 4
        WHEN rn = 2 THEN 3  -- Сотрудник Б: частота = 3
    END,
    CASE 
        WHEN rn = 1 THEN 1  -- Сотрудник A: невыполненные = 1
        WHEN rn = 2 THEN 2  -- Сотрудник Б: невыполненные = 2
    END,
    CASE 
        WHEN rn = 1 THEN 2  -- Сотрудник A: выполненные = 2
        WHEN rn = 2 THEN 1  -- Сотрудник Б: выполненные = 1
    END,
    CASE 
        WHEN rn = 1 THEN 450000  -- Сотрудник A: контракты = 450,000 ₽
        WHEN rn = 2 THEN 300000  -- Сотрудник Б: контракты = 300,000 ₽
    END,
    CASE 
        WHEN rn = 1 THEN 0  -- Сотрудник A: опоздания = 0
        WHEN rn = 2 THEN 1  -- Сотрудник Б: опоздания = 1
    END
FROM test_users
ON CONFLICT DO NOTHING;

-- =============================================
-- 3. MANUAL CALCULATION DEMONSTRATION
-- =============================================

-- Показываем пошаговый расчет для понимания формулы
WITH step_by_step AS (
    SELECT 
        p.full_name,
        em.task_completion_frequency,
        em.tasks_not_completed_on_time,
        em.tasks_completed_on_time,
        em.total_contract_value,
        em.number_of_delays,
        
        -- Шаг 1: Частота выполнения задач (положительный, вес=1, макс=5)
        ROUND((1.0 * 1.0 * (em.task_completion_frequency::numeric / 5.0)), 4) as step_1,
        
        -- Шаг 2: Невыполненные задачи (отрицательный, вес=0.75, макс=3)
        ROUND((-1.0 * 0.75 * (em.tasks_not_completed_on_time::numeric / 3.0)), 4) as step_2,
        
        -- Шаг 3: Выполненные задачи (положительный, вес=1, макс=2)
        ROUND((1.0 * 1.0 * (em.tasks_completed_on_time::numeric / 2.0)), 4) as step_3,
        
        -- Шаг 4: Стоимость контрактов (положительный, вес=1, макс=650000)
        ROUND((1.0 * 1.0 * (em.total_contract_value / 650000.0)), 4) as step_4,
        
        -- Шаг 5: Опоздания (отрицательный, вес=0.5, макс=2)
        ROUND((-1.0 * 0.5 * (em.number_of_delays::numeric / 2.0)), 4) as step_5
    FROM employee_metrics em
    JOIN profiles p ON em.user_id = p.id
    WHERE em.period_start = '2024-01-01' AND em.period_end = '2024-01-31'
),
final_calculation AS (
    SELECT 
        *,
        ROUND((step_1 + step_2 + step_3 + step_4 + step_5), 4) as total_score
    FROM step_by_step
)
SELECT 
    'Пошаговый расчет баллов' as calculation_type,
    full_name as "Сотрудник",
    task_completion_frequency as "Частота",
    tasks_not_completed_on_time as "Невыполненные",
    tasks_completed_on_time as "Выполненные",
    total_contract_value as "Контракты_₽",
    number_of_delays as "Опоздания",
    step_1 as "Критерий_1_Частота",
    step_2 as "Критерий_2_Невыполненные",
    step_3 as "Критерий_3_Выполненные",
    step_4 as "Критерий_4_Контракты",
    step_5 as "Критерий_5_Опоздания",
    total_score as "Итоговый_балл"
FROM final_calculation
ORDER BY total_score DESC;

-- =============================================
-- 4. CALCULATE PREMIUMS
-- =============================================

-- Вызываем функцию расчета премий
SELECT calculate_premium_distribution(
    (SELECT id FROM premium_funds WHERE period_start = '2024-01-01' LIMIT 1)
);

-- =============================================
-- 5. SHOW FINAL RESULTS
-- =============================================

-- Показываем финальные результаты
SELECT 
    'Финальные результаты расчета премий' as result_type,
    p.full_name as "Сотрудник",
    em.task_completion_frequency as "Частота_выполнения",
    em.tasks_not_completed_on_time as "Невыполненные_в_срок",
    em.tasks_completed_on_time as "Выполненные_в_срок",
    em.total_contract_value as "Стоимость_контрактов_₽",
    em.number_of_delays as "Количество_опозданий",
    ROUND(em.normalized_score, 4) as "Нормализованный_балл",
    ROUND(em.premium_amount, 2) as "Сумма_премии_₽",
    ROUND((em.premium_amount / 100000 * 100), 2) as "Процент_от_фонда_%"
FROM employee_metrics em
JOIN profiles p ON em.user_id = p.id
WHERE em.period_start = '2024-01-01' AND em.period_end = '2024-01-31'
ORDER BY em.normalized_score DESC;

-- =============================================
-- 6. VERIFICATION
-- =============================================

-- Проверяем, что сумма премий не превышает фонд
SELECT 
    'Проверка корректности расчета' as verification_type,
    pf.total_fund_amount as "Общий_фонд_₽",
    ROUND(SUM(em.premium_amount), 2) as "Распределено_₽",
    ROUND(pf.total_fund_amount - SUM(em.premium_amount), 2) as "Остаток_₽",
    CASE 
        WHEN SUM(em.premium_amount) <= pf.total_fund_amount THEN '✅ Корректно'
        ELSE '❌ Ошибка: превышение фонда'
    END as "Статус_проверки"
FROM premium_funds pf
LEFT JOIN employee_metrics em ON em.period_start = pf.period_start AND em.period_end = pf.period_end
WHERE pf.period_start = '2024-01-01'
GROUP BY pf.id, pf.total_fund_amount;

SELECT 'Тест системы расчета премий выполнен успешно' as status;

