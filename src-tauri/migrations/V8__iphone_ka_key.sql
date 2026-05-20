-- V8: Ajout de la colonne ka_public_key pour le key-wrapping ECIES (protocole v2)
ALTER TABLE iphone_pairing ADD COLUMN ka_public_key BLOB;
