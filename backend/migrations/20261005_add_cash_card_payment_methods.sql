USE kairos_db;

-- Existing installations may use either VARCHAR or an ENUM for method_type.
SET @method_type_is_enum = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'PaymentMethods'
    AND COLUMN_NAME = 'method_type'
    AND DATA_TYPE = 'enum'
);

SET @method_type_sql = IF(
  @method_type_is_enum = 1,
  "ALTER TABLE PaymentMethods MODIFY method_type ENUM('gcash', 'bank', 'other', 'cash', 'card') NOT NULL",
  'SELECT 1'
);
PREPARE method_type_statement FROM @method_type_sql;
EXECUTE method_type_statement;
DEALLOCATE PREPARE method_type_statement;

ALTER TABLE PaymentMethods MODIFY qr_image_url VARCHAR(500) NULL;

INSERT INTO PaymentMethods (method_name, method_type, qr_image_url, account_name, account_number)
SELECT 'Cash', 'cash', NULL, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM PaymentMethods WHERE method_type = 'cash'
);

INSERT INTO PaymentMethods (method_name, method_type, qr_image_url, account_name, account_number)
SELECT 'Card', 'card', NULL, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM PaymentMethods WHERE method_type = 'card'
);
