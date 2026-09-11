-- New plan names are added separately so PostgreSQL can commit enum values
-- before the following migration uses them in rows and constraints.
alter type plan_code add value if not exists 'STARTER';
alter type plan_code add value if not exists 'BUSINESS';
