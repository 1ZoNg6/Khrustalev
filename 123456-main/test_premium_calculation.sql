-- =============================================
-- Test Premium Calculation System
-- =============================================
-- Тестирование системы расчета премий с реальными данными

-- =============================================
-- 1. CREATE TEST PREMIUM FUND
-- =============================================

-- Создаем тестовый премиальный фонд на период
INSERT INTO premium_funds (period_start, period_end, total_fund_amount, created_by)
SELECT 
    '2024-01-01'::date,
    '2024-01-31'::date,
    100000, -- 100,000 рублей премиального фонда
    (SELECT id FROM profiles WHERE role = 'Администратор' LIMIT 1)
WHERE EXISTS (SELECT 1 FROM profiles WHERE role = 'Администратор');

-- =============================================
-- 2. INSERT TEST EMPLOYEE METRICS
-- =============================================

-- Сотрудник A (из таблицы)
INSERT INTO employee_metrics (
    user_id,
    period_start,
    period_end,
    task_completion_frequency,      -- Частота: 4
    tasks_not_completed_on_time,    -- Невыполненные: 1
    tasks_completed_on_time,        -- Выполненные: 2
    total_contract_value,           -- Контракты: 450,000 ₽
    number_of_delays               -- Опоздания: 0
)
SELECT 
    (SELECT id FROM profiles WHERE role = 'Работник' LIMIT 1),
    '2024-01-01'::date,
    '2024-01-31'::date,
    4,      -- Частота выполнения задач
    1,      -- Количество невыполненных задач в срок
    2,      -- Количество выполненных задач в срок
    450000, -- Общая сумма стоимости всех контрактов
    0       -- Количество опозданий
WHERE EXISTS (SELECT 1 FROM profiles WHERE role = 'Работник');

-- Сотрудник Б (из таблицы)
INSERT INTO employee_metrics (
    user_id,
    period_start,
    period_end,
    task_completion_frequency,      -- Частота: 3
    tasks_not_completed_on_time,    -- Невыполненные: 2
    tasks_completed_on_time,        -- Выполненные: 1
    total_contract_value,           -- Контракты: 300,000 ₽
    number_of_delays               -- Опоздания: 1
)
SELECT 
    (SELECT id FROM profiles WHERE role = 'Работник' ORDER BY created_at DESC LIMIT 1 OFFSET 1),
    '2024-01-01'::date,
    '2024-01-31'::date,
    3,      -- Частота выполнения задач
    2,      -- Количество невыполненных задач в срок
    1,      -- Количество выполненных задач в срок
    300000, -- Общая сумма стоимости всех контрактов
    1       -- Количество опозданий
WHERE EXISTS (SELECT 1 FROM profiles WHERE role = 'Работник' ORDER BY created_at DESC LIMIT 1 OFFSET 1);

-- =============================================
-- 3. MANUAL CALCULATION FOR VERIFICATION
-- =============================================

-- Показываем ручной расчет для проверки
WITH manual_calculation AS (
    SELECT 
        user_id,
        -- Критерий 1: Частота выполнения задач (положительный, вес=1, макс=5)
        (1.0 * 1.0 * (task_completion_frequency::numeric / 5.0)) as criterion_1,
        
        -- Критерий 2: Невыполненные задачи (отрицательный, вес=0.75, макс=3)
        (-1.0 * 0.75 * (tasks_not_completed_on_time::numeric / 3.0)) as criterion_2,
        
        -- Критерий 3: Выполненные задачи (положительный, вес=1, макс=2)
        (1.0 * 1.0 * (tasks_completed_on_time::numeric / 2.0)) as criterion_3,
        
        -- Критерий 4: Стоимость контрактов (положительный, вес=1, макс=650000)
        (1.0 * 1.0 * (total_contract_value / 650000.0)) as criterion_4,
        
        -- Критерий 5: Опоздания (отрицательный, вес=0.5, макс=2)
        (-1.0 * 0.5 * (number_of_delays::numeric / 2.0)) as criterion_5,
        
        -- Исходные данные
        task_completion_frequency,
        tasks_not_completed_on_time,
        tasks_completed_on_time,
        total_contract_value,
        number_of_delays
    FROM employee_metrics
    WHERE period_start = '2024-01-01' AND period_end = '2024-01-31'
),
calculated_scores AS (
    SELECT 
        user_id,
        criterion_1,
        criterion_2,
        criterion_3,
        criterion_4,
        criterion_5,
        (criterion_1 + criterion_2 + criterion_3 + criterion_4 + criterion_5) as total_score,
        task_completion_frequency,
        tasks_not_completed_on_time,
        tasks_completed_on_time,
        total_contract_value,
        number_of_delays
    FROM manual_calculation
)
SELECT 
    'Ручной расчет баллов' as calculation_type,
    user_id,
    task_completion_frequency as "Частота",
    tasks_not_completed_on_time as "Невыполненные",
    tasks_completed_on_time as "Выполненные",
    total_contract_value as "Контракты_₽",
    number_of_delays as "Опоздания",
    ROUND(criterion_1, 4) as "Критерий_1",
    ROUND(criterion_2, 4) as "Критерий_2", 
    ROUND(criterion_3, 4) as "Критерий_3",
    ROUND(criterion_4, 4) as "Критерий_4",
    ROUND(criterion_5, 4) as "Критерий_5",
    ROUND(total_score, 4) as "Итоговый_балл"
FROM calculated_scores;

-- =============================================
-- 4. CALCULATE PREMIUMS USING FUNCTION
-- =============================================

-- Вызываем функцию расчета премий
SELECT calculate_premium_distribution(
    (SELECT id FROM premium_funds WHERE period_start = '2024-01-01' LIMIT 1)
);

-- =============================================
-- 5. SHOW RESULTS
-- =============================================

-- Показываем результаты расчета
SELECT 
    'Результаты расчета премий' as result_type,
    p.full_name as "Сотрудник",
    em.task_completion_frequency as "Частота",
    em.tasks_not_completed_on_time as "Невыполненные",
    em.tasks_completed_on_time as "Выполненные",
    em.total_contract_value as "Контракты_₽",
    em.number_of_delays as "Опоздания",
    ROUND(em.normalized_score, 4) as "Нормализованный_балл",
    ROUND(em.premium_amount, 2) as "Премия_₽",
    ROUND((em.premium_amount / pf.total_fund_amount * 100), 2) as "Процент_от_фонда"
FROM employee_metrics em
JOIN profiles p ON em.user_id = p.id
JOIN premium_funds pf ON em.period_start = pf.period_start AND em.period_end = pf.period_end
WHERE em.period_start = '2024-01-01' AND em.period_end = '2024-01-31'
ORDER BY em.normalized_score DESC;

-- =============================================
-- 6. VERIFICATION SUMMARY
-- =============================================

-- Сводка по фонду
SELECT 
    'Сводка по премиальному фонду' as summary_type,
    pf.period_start as "Начало_периода",
    pf.period_end as "Конец_периода",
    pf.total_fund_amount as "Общий_фонд_₽",
    COUNT(em.id) as "Количество_сотрудников",
    ROUND(SUM(em.premium_amount), 2) as "Распределено_₽",
    ROUND(pf.total_fund_amount - SUM(em.premium_amount), 2) as "Остаток_₽",
    pf.status as "Статус_фонда"
FROM premium_funds pf
LEFT JOIN employee_metrics em ON em.period_start = pf.period_start AND em.period_end = pf.period_end
WHERE pf.period_start = '2024-01-01'
GROUP BY pf.id, pf.period_start, pf.period_end, pf.total_fund_amount, pf.status;

SELECT 'Тест системы расчета премий завершен' as status;

