-- School-focused physical goods taxonomy. This does not rename or remove
-- existing categories or change any seller's product assignments.
INSERT INTO marketplace_categories (name, slug, description, icon, color, sort_order, is_active)
VALUES
  ('School Bags', 'school-bags', 'Backpacks, book bags, lunch bags, and cases', '🎒', '#2563EB', -7, true),
  ('Textbooks & Readers', 'textbooks-readers', 'Curriculum textbooks, readers, and workbooks', '📚', '#7C3AED', -6, true),
  ('Uniforms & Shoes', 'school-uniforms-shoes', 'School uniforms, socks, and school shoes', '👕', '#0F766E', -5, true),
  ('Stationery & Supplies', 'school-stationery-supplies', 'Exercise books, pens, pencils, and classroom supplies', '✏️', '#D97706', -4, true),
  ('Learning Devices', 'learning-devices', 'Calculators, tablets, and approved learning devices', '💻', '#0284C7', -3, true),
  ('Sports & PE', 'school-sports-pe', 'Physical education clothing and equipment', '⚽', '#16A34A', -2, true),
  ('Art & Lab Supplies', 'school-art-lab-supplies', 'Art materials and practical science supplies', '🎨', '#DC2626', -1, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = true;
