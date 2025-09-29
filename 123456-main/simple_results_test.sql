-- =============================================
-- Simple Results Test - Показывает только результаты
-- =============================================

-- =============================================
-- 1. CREATE TEST DATA
-- =============================================

-- Создаем премиальный фонд
INSERT INTO premium_funds (period_start, period_end, total_fund_amount, created_by)
SELECT 
    '2024-01-01'::date,
    '2024-01-31'::date,
    100000, -- 100,000 рублей
    (SELECT id FROM profiles LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM premium_funds WHERE period_start = '2024-01-01');

-- Добавляем метрики для двух сотрудников
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
    (SELECT id FROM profiles WHERE role = 'Работник' LIMIT 1),
    '2024-01-01'::date,
    '2024-01-31'::date,
    4,      -- Частота выполнения задач
    1,      -- Невыполненные в срок
    2,      -- Выполненные в срок
    450000, -- Стоимость контрактов
    0       -- Опоздания
WHERE NOT EXISTS (SELECT 1 FROM employee_metrics WHERE period_start = '2024-01-01');

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
    (SELECT id FROM profiles WHERE role = 'Работник' ORDER BY created_at DESC LIMIT 1),
    '2024-01-01'::date,
    '2024-01-31'::date,
    3,      -- Частота выполнения задач
    2,      -- Невыполненные в срок
    1,      -- Выполненные в срок
    300000, -- Стоимость контрактов
    1       -- Опоздания
WHERE NOT EXISTS (SELECT 1 FROM employee_metrics WHERE period_start = '2024-01-01' AND user_id != (SELECT id FROM profiles WHERE role = 'Работник' LIMIT 1));

-- =============================================
-- 2. CALCULATE PREMIUMS
-- =============================================

-- Вызываем функцию расчета премий
SELECT calculate_premium_distribution(
    (SELECT id FROM premium_funds WHERE period_start = '2024-01-01' LIMIT 1)
);

-- =============================================
-- 3. SHOW RESULTS
-- =============================================

-- Показываем результаты расчета
SELECT 
    '🎯 РЕЗУЛЬТАТЫ РАСЧЕТА ПРЕМИЙ' as title;

-- Основные результаты
SELECT 
    p.full_name as "Сотрудник",
    em.task_completion_frequency as "Частота",
    em.tasks_not_completed_on_time as "Невыполненные",
    em.tasks_completed_on_time as "Выполненные",
    em.total_contract_value as "Контракты (₽)",
    em.number_of_delays as "Опоздания",
    ROUND(em.normalized_score, 4) as "Балл",
    ROUND(em.premium_amount, 2) as "Премия (₽)",
    ROUND((em.premium_amount / 100000 * 100), 2) as "% от фонда"
FROM employee_metrics em
JOIN profiles p ON em.user_id = p.id
WHERE em.period_start = '2024-01-01' AND em.period_end = '2024-01-31'
ORDER BY em.normalized_score DESC;

-- Сводка по фонду
SELECT 
    '📋 СВОДКА ПО ФОНДУ' as title;

SELECT 
    pf.period_start as "Начало периода",
    pf.period_end as "Конец периода",
    pf.total_fund_amount as "Общий фонд (₽)",
    COUNT(em.id) as "Количество сотрудников",
    ROUND(SUM(em.premium_amount), 2) as "Распределено (₽)",
    ROUND(pf.total_fund_amount - SUM(em.premium_amount), 2) as "Остаток (₽)",
    CASE 
        WHEN SUM(em.premium_amount) <= pf.total_fund_amount THEN '✅ Корректно'
        ELSE '❌ Ошибка: превышение фонда'
    END as "Статус проверки"
FROM premium_funds pf
LEFT JOIN employee_metrics em ON em.period_start = pf.period_start AND em.period_end = pf.period_end
WHERE pf.period_start = '2024-01-01'
GROUP BY pf.id, pf.period_start, pf.period_end, pf.total_fund_amount;

-- Детальный расчет баллов
SELECT 
    '🧮 ДЕТАЛЬНЫЙ РАСЧЕТ БАЛЛОВ' as title;

WITH detailed_calculation AS (
    SELECT 
        p.full_name,
        em.task_completion_frequency,
        em.tasks_not_completed_on_time,
        em.tasks_completed_on_time,
        em.total_contract_value,
        em.number_of_delays,
        
        -- Критерий 1: Частота выполнения задач (положительный, вес=1, макс=5)
        ROUND((1.0 * 1.0 * (em.task_completion_frequency::numeric / 5.0)), 4) as criterion_1,
        
        -- Критерий 2: Невыполненные задачи (отрицательный, вес=0.75, макс=3)
        ROUND((-1.0 * 0.75 * (em.tasks_not_completed_on_time::numeric / 3.0)), 4) as criterion_2,
        
        -- Критерий 3: Выполненные задачи (положительный, вес=1, макс=2)
        ROUND((1.0 * 1.0 * (em.tasks_completed_on_time::numeric / 2.0)), 4) as criterion_3,
        
        -- Критерий 4: Стоимость контрактов (положительный, вес=1, макс=650000)
        ROUND((1.0 * 1.0 * (em.total_contract_value / 650000.0)), 4) as criterion_4,
        
        -- Критерий 5: Опоздания (отрицательный, вес=0.5, макс=2)
        ROUND((-1.0 * 0.5 * (em.number_of_delays::numeric / 2.0)), 4) as criterion_5
    FROM employee_metrics em
    JOIN profiles p ON em.user_id = p.id
    WHERE em.period_start = '2024-01-01' AND em.period_end = '2024-01-31'
),
final_scores AS (
    SELECT 
        *,
        ROUND((criterion_1 + criterion_2 + criterion_3 + criterion_4 + criterion_5), 4) as total_score
    FROM detailed_calculation
)
SELECT 
    full_name as "Сотрудник",
    task_completion_frequency as "Частота",
    tasks_not_completed_on_time as "Невыполненные",
    tasks_completed_on_time as "Выполненные",
    total_contract_value as "Контракты (₽)",
    number_of_delays as "Опоздания",
    criterion_1 as "Критерий 1",
    criterion_2 as "Критерий 2",
    criterion_3 as "Критерий 3",
    criterion_4 as "Критерий 4",
    criterion_5 as "Критерий 5",
    total_score as "Итоговый балл"
FROM final_scores
ORDER BY total_score DESC;

SELECT '✅ Тест системы расчета премий завершен успешно!' as status;

