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