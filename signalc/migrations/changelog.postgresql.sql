-- liquibase formatted sql

-- changeset aguestuser:1610737575533-1 failOnError:false
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

-- changeset aguestuser:1610737575533-2 failOnError:false
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

-- changeset aguestuser:1610737575533-3 failOnError:false
CREATE TABLE IF NOT EXISTS ownidentities
(
    account_id VARCHAR(255) NOT NULL,
    keypair_bytes BYTEA NOT NULL,
    registration_id INTEGER NOT NULL,
     CONSTRAINT ownidentities_pkey PRIMARY KEY (account_id)
);
-- rollback drop table ownidentities;

-- changeset aguestuser:1610737575533-4 failOnError:false
CREATE TABLE IF NOT EXISTS prekeys
(
    account_id VARCHAR(255) NOT NULL,
    prekey_id INTEGER NOT NULL,
    prekey_bytes BYTEA NOT NULL,
    CONSTRAINT pk_prekeys PRIMARY KEY (account_id, prekey_id)
);
-- rollback drop table prekeys;

-- changeset aguestuser:1610737575533-5 failOnError:false
CREATE TABLE IF NOT EXISTS sessions
(
    account_id VARCHAR(255) NOT NULL,
     name VARCHAR(255) NOT NULL,
     device_id INTEGER NOT NULL,
     session_bytes BYTEA NOT NULL,
     CONSTRAINT pk_sessions PRIMARY KEY (account_id, name, device_id)
);
-- rollback drop table sessions;

-- changeset aguestuser:1610737575533-6 failOnError:false
CREATE TABLE IF NOT EXISTS signedprekeys
(
    account_id VARCHAR(255) NOT NULL,
    id INTEGER NOT NULL,
    signed_prekey_bytes BYTEA NOT NULL,
    CONSTRAINT pk_signedprekeys
        PRIMARY KEY (account_id, id)
);
-- rollback drop table signedprekeys;

-- changeset fdbk:1618858708962-1 failOnError:false
CREATE INDEX identities_identity_key_bytes ON identities (identity_key_bytes)
-- rollback drop index identities_identity_key_bytes;

-- changeset fdbk:1618858708962-2 failOnError:false
CREATE INDEX identities_account_id_name ON identities (account_id, "name")
-- rollback drop index identities_account_id_name;
