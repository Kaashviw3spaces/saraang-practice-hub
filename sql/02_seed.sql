-- Seed Data for Saraang Music Club

-- 1. Required Session Types Constraints
INSERT INTO session_types (name, participant_limit, is_strict_lockdown)
VALUES 
    ('Session A', 8, FALSE),
    ('Session B', 6, FALSE),
    ('Jam Session', 8, FALSE),
    ('Recording Session', 4, TRUE),
    ('Meeting Session', 10, FALSE)
ON CONFLICT (name) DO UPDATE SET 
    participant_limit = EXCLUDED.participant_limit,
    is_strict_lockdown = EXCLUDED.is_strict_lockdown;

-- 2. Starter Rooms (Acoustic Profiles for AI Engine)
INSERT INTO rooms (name, base_capacity, max_decibel_threshold, echo_factor)
VALUES 
    ('Studio A - Live Room', 8, 115, 1.20),
    ('Studio B - Control Room', 6, 85, 0.40),
    ('Jam Pod 1', 8, 105, 0.85),
    ('Acoustic Isolation Booth', 4, 75, 0.20)
ON CONFLICT (name) DO UPDATE SET
    base_capacity = EXCLUDED.base_capacity,
    max_decibel_threshold = EXCLUDED.max_decibel_threshold,
    echo_factor = EXCLUDED.echo_factor;

-- 3. Starter Instruments Catalogue (for AI Decibel & Frequency Engine)
INSERT INTO instruments (id, name, category, base_decibels, frequency_band)
VALUES 
    (1, 'Drums', 'Percussion', 110, 'Low-Mid'),
    (2, 'Electric Bass', 'Strings', 100, 'Low'),
    (3, 'Electric Guitar', 'Strings', 95, 'Mid'),
    (4, 'Acoustic Guitar', 'Strings', 75, 'Mid'),
    (5, 'Vocals', 'Vocals', 85, 'High-Mid'),
    (6, 'Synthesizer / Keyboard', 'Keys', 80, 'Full-Range'),
    (7, 'Cajon & Hand Percussion', 'Percussion', 80, 'Mid')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    base_decibels = EXCLUDED.base_decibels,
    frequency_band = EXCLUDED.frequency_band;
