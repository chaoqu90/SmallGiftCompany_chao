-- TEST cleanup: truncate all generated-bundle and catalog tables in dependency order.
TRUNCATE generated_bundle_gift_bag CASCADE;
TRUNCATE generated_bundle_upgrade CASCADE;
TRUNCATE generated_bundle_item CASCADE;
TRUNCATE generated_bundle CASCADE;
TRUNCATE gift_bag_option CASCADE;
TRUNCATE bundle_template_slot_role CASCADE;
TRUNCATE bundle_template_slot CASCADE;
TRUNCATE bundle_template CASCADE;
TRUNCATE budget_tier CASCADE;
TRUNCATE product_role_affinity CASCADE;
TRUNCATE product_occasion CASCADE;
TRUNCATE product_audience_affinity CASCADE;
TRUNCATE product_interest_affinity CASCADE;
TRUNCATE product RESTART IDENTITY CASCADE;
