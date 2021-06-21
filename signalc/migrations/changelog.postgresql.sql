-- liquibase formatted sql

-- changeset aguestuser:1610737575533-1 failOnError:true
CREATE TABLE IF NOT EXISTS accounts
(
    uuid UUID,
    status VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    signaling_key VARCHAR(255) NOT NULL,
    profile_key_bytes BYTEA NOT NULL,
    device_id INTEGER NOT NULL,
    CONSTRAINT accounts_pkey PRIMARY KEY (username)
);
-- rollback drop table accounts;

-- changeset aguestuser:1610737575533-2 failOnError:true
CREATE TABLE IF NOT EXISTS identities
(
    account_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    device_id INTEGER NOT NULL,
    identity_key_bytes BYTEA NOT NULL,
    is_trusted BOOLEAN DEFAULT TRUE NOT NULL,
    CONSTRAINT pk_identities PRIMARY KEY (account_id, name, device_id)
);
-- rollback drop table identities;

-- changeset aguestuser:1610737575533-3 failOnError:true
CREATE TABLE IF NOT EXISTS ownidentities
(
    account_id VARCHAR(255) NOT NULL,
    keypair_bytes BYTEA NOT NULL,
    registration_id INTEGER NOT NULL,
     CONSTRAINT ownidentities_pkey PRIMARY KEY (account_id)
);
-- rollback drop table ownidentities;

-- changeset aguestuser:1610737575533-4 failOnError:true
CREATE TABLE IF NOT EXISTS prekeys
(
    account_id VARCHAR(255) NOT NULL,
    prekey_id INTEGER NOT NULL,
    prekey_bytes BYTEA NOT NULL,
    CONSTRAINT pk_prekeys PRIMARY KEY (account_id, prekey_id)
);
-- rollback drop table prekeys;

-- changeset aguestuser:1610737575533-5 failOnError:true
CREATE TABLE IF NOT EXISTS sessions
(
    account_id VARCHAR(255) NOT NULL,
     name VARCHAR(255) NOT NULL,
     device_id INTEGER NOT NULL,
     session_bytes BYTEA NOT NULL,
     CONSTRAINT pk_sessions PRIMARY KEY (account_id, name, device_id)
);
-- rollback drop table sessions;

-- changeset aguestuser:1610737575533-6 failOnError:true
CREATE TABLE IF NOT EXISTS signedprekeys
(
    account_id VARCHAR(255) NOT NULL,
    id INTEGER NOT NULL,
    signed_prekey_bytes BYTEA NOT NULL,
    CONSTRAINT pk_signedprekeys
        PRIMARY KEY (account_id, id)
);
-- rollback drop table signedprekeys;

-- changeset fdbk:1618858708962-1 failOnError:true
CREATE INDEX identities_identity_key_bytes ON identities (identity_key_bytes)
-- rollback drop index identities_identity_key_bytes;

-- changeset fdbk:1618858708962-2 failOnError:true
CREATE INDEX identities_account_id_name ON identities (account_id, "name")
-- rollback drop index identities_account_id_name;

-- changeset aguestuser:1618854201895-1 failOnError:true
CREATE TABLE IF NOT EXISTS envelopes
(
    id uuid PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    envelope_bytes bytea NOT NULL,
    server_delivered_timestamp BIGINT NOT NULL
);
-- rollback drop table envelopes;

-- changeset aguestuser:1620095897702-1 failOnError:true
drop table envelopes;
-- rollback CREATE TABLE IF NOT EXISTS envelopes
-- rollback (
-- rollback    id uuid PRIMARY KEY,
-- rollback    account_id VARCHAR(255) NOT NULL,
-- rollback    envelope_bytes bytea NOT NULL,
-- rollback    server_delivered_timestamp BIGINT NOT NULL
-- rollback    );

-- changeset aguestuser:1620958605837-1 failOnError:true
CREATE TABLE IF NOT EXISTS senderkeys
(
    account_id VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    device_id INT NOT NULL,
    distribution_id uuid NOT NULL,
    identity_key_bytes bytea NOT NULL,
    CONSTRAINT pk_SenderKeys PRIMARY KEY (account_id, "name", device_id, distribution_id)
);
-- rollback drop table senderkeys;

-- changeset aguestuser:1622573292148-1 failOnError:true
ALTER TABLE identities DROP CONSTRAINT pk_identities;
DROP INDEX identities_account_id_name;
ALTER TABLE identities RENAME COLUMN "name" TO contact_id;
ALTER TABLE identities ADD CONSTRAINT pk_identities PRIMARY KEY (account_id, contact_id, device_id);
CREATE INDEX identities_account_id_contact_id ON identities (account_id, contact_id);
ALTER TABLE sessions DROP CONSTRAINT pk_sessions;
ALTER TABLE sessions RENAME COLUMN "name" TO contact_id;
ALTER TABLE sessions ADD CONSTRAINT pk_sessions PRIMARY KEY (account_id, contact_id, device_id);
-- rollback ALTER TABLE identities DROP CONSTRAINT pk_identities;
-- rollback DROP INDEX identities_account_id_contact_id;
-- rollback ALTER TABLE identities RENAME COLUMN contact_id TO "name";
-- rollback ALTER TABLE identities ADD CONSTRAINT pk_identities PRIMARY KEY (account_id, "name", device_id);
-- rollback CREATE INDEX identities_account_id_name ON identities (account_id, "name");
-- rollback ALTER TABLE sessions DROP CONSTRAINT pk_sessions;
-- rollback ALTER TABLE sessions RENAME COLUMN contact_id TO "name";
-- rollback ALTER TABLE sessions ADD CONSTRAINT pk_sessions PRIMARY KEY (account_id, "name", device_id);


-- changeset aguestuser:1621982248825-1 failOnError:false
CREATE TABLE IF NOT EXISTS profiles (
    account_id VARCHAR(255),
    contact_id VARCHAR(255),
    profile_key_bytes bytea NOT NULL,
    CONSTRAINT pk_Profiles PRIMARY KEY (account_id, contact_id)
);
-- rollback drop table profiles;

-- changeset aguestuser:1622583774849-1 failOnError:true
DELETE FROM identities WHERE device_id <> 1;
ALTER TABLE identities DROP CONSTRAINT pk_identities;
ALTER TABLE identities DROP COLUMN device_id;
DROP INDEX identities_account_id_contact_id;
ALTER TABLE identities ADD CONSTRAINT pk_identities PRIMARY KEY (account_id, contact_id);
-- rollback ALTER TABLE identities DROP CONSTRAINT pk_identities;
-- rollback ALTER TABLE identities ADD COLUMN device_id INTEGER;
-- rollback UPDATE identities set device_id = 1;
-- rollback ALTER TABLE identities ADD CONSTRAINT pk_identities PRIMARY KEY (account_id, contact_id, device_id);
-- rollback CREATE INDEX identities_account_id_contact_id ON identities (account_id, contact_id);

-- changeset aguestuser:1622683725211-1 failOnError:true
ALTER TABLE identities
    ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW();
-- rollback ALTER TABLE identities
-- rollback     DROP COLUMN created_at,
-- rollback     DROP COLUMN updated_at;

-- changeset aguestuser:1622741296513-1 failOnError:true
CREATE TABLE IF NOT EXISTS contacts (
    account_id VARCHAR(255),
    contact_id SERIAL,
    uuid uuid NULL,
    phone_number VARCHAR(255) NOT NULL,
    profile_key_bytes bytea NULL,
    CONSTRAINT pk_Contacts PRIMARY KEY (contact_id, account_id)
);
CREATE INDEX contacts_account_id_uuid ON contacts (account_id, uuid);
CREATE INDEX contacts_account_id_phone_number ON contacts (account_id, phone_number);
-- rollback DROP TABLE contacts;


-- changeset aguestuser:1623100049239-1 failOnError:true
DELETE FROM accounts;
DELETE FROM contacts;
DELETE FROM identities;
DELETE FROM ownidentities;
DELETE FROM prekeys;
DELETE FROM profiles;
DELETE FROM senderkeys;
DELETE FROM sessions;
DELETE FROM signedprekeys;

ALTER TABLE identities DROP CONSTRAINT pk_identities;
ALTER TABLE identities DROP COLUMN contact_id;
ALTER TABLE identities ADD COLUMN contact_id INT;
ALTER TABLE identities ADD CONSTRAINT pk_identities PRIMARY KEY (account_id, contact_id);

ALTER TABLE sessions DROP CONSTRAINT pk_sessions;
ALTER TABLE sessions DROP COLUMN contact_id;
ALTER TABLE sessions ADD COLUMN contact_id INT;
ALTER TABLE sessions ADD CONSTRAINT pk_sessions PRIMARY KEY (account_id, contact_id, device_id);
-- rollback DELETE FROM accounts;
-- rollback DELETE FROM contacts;
-- rollback DELETE FROM identities;
-- rollback DELETE FROM ownidentities;
-- rollback DELETE FROM prekeys;
-- rollback DELETE FROM profiles;
-- rollback DELETE FROM senderkeys;
-- rollback DELETE FROM sessions;
-- rollback DELETE FROM signedprekeys;
-- rollback
-- rollback ALTER TABLE identities DROP CONSTRAINT pk_identities;
-- rollback ALTER TABLE identities DROP COLUMN contact_id;
-- rollback ALTER TABLE identities ADD COLUMN contact_id VARCHAR(255) NOT NULL;
-- rollback ALTER TABLE identities ADD CONSTRAINT pk_identities PRIMARY KEY (account_id, contact_id);
-- rollback
-- rollback ALTER TABLE sessions DROP CONSTRAINT pk_sessions;
-- rollback ALTER TABLE sessions DROP COLUMN contact_id;
-- rollback ALTER TABLE sessions ADD COLUMN contact_id VARCHAR(255) NOT NULL;
-- rollback ALTER TABLE sessions ADD CONSTRAINT pk_sessions PRIMARY KEY (account_id, contact_id, device_id);

-- changeset aguestuser:1623100049239-2 failOnError:true
DROP INDEX identities_identity_key_bytes;
-- rollback CREATE INDEX identities_identity_key_bytes ON identities (identity_key_bytes);


-- changeset fdbk:1623280052786-1 failOnError:true
ALTER TABLE contacts ALTER COLUMN phone_number DROP NOT NULL;
-- rollback ALTER TABLE contacts ALTER COLUMN phone_number SET NOT NULL;

-- changeset aguestuser:1624301616527-1 failOnError:true
-- NOTE: This migration introduces uniqueness constraints that will fail if there are any duplicate account_id/uuid or
-- account_id/phone_number combinations for any contact rows. Such dupes constitute an illegal state.
-- They are associated with bugs that we have now eradicated from the code. However, we nevertheless
-- begin this migration with 2 queries to clear all contacts having such an illegal state so that dev environments
-- created before the bug was eradicated may successfully run this migration.
-- Here we remove all contacts with duplicate account_id/uuid combos:
with uuid_counts as (
    select count(*), account_id, uuid from contacts
    group by account_id, uuid
    order by count(*)
),
uuid_dupes as (
    select account_id, uuid from uuid_counts where uuid_counts.count > 1
)
delete from contacts where (account_id, uuid) in (select * from uuid_dupes);
-- Here we remove all contacts with duplicate account_id/phone_number combos:
with phone_number_counts as (
    select count(*), account_id, phone_number from contacts
    group by account_id, phone_number
    order by count(*)
),
phone_number_dupes as (
    select account_id, phone_number from phone_number_counts where phone_number_counts.count > 1
)
delete from contacts where (account_id, phone_number) in (select * from phone_number_dupes);
-- And now we proceed to the migration!
DROP INDEX contacts_account_id_uuid;
CREATE UNIQUE INDEX contacts_account_id_uuid ON contacts (account_id, uuid);
DROP INDEX contacts_account_id_phone_number;
CREATE UNIQUE INDEX contacts_account_id_phone_number ON contacts (account_id, phone_number);
-- rollback DROP INDEX contacts_account_id_uuid;
-- rollback CREATE INDEX contacts_account_id_uuid ON contacts (account_id, uuid);
-- rollback DROP INDEX contacts_account_id_phone_number;
-- rollback CREATE INDEX contacts_account_id_phone_number ON contacts (account_id, phone_number);

-- changeset aguestuser:1624301616527-2 failOnError:true
ALTER TABLE contacts ALTER COLUMN phone_number DROP DEFAULT;
-- rollback ALTER TABLE contacts ALTER COLUMN phone_number SET DEFAULT '';

-- changeset aguestuser:1624301616527-3 failOnError:true
ALTER TABLE contacts ADD CONSTRAINT phone_number_regex CHECK(phone_number ~ '^\+\d{9,15}\Z');
-- rollback ALTER TABLE contacts DROP CONSTRAINT phone_number_regex;

