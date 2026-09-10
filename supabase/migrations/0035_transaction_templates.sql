-- 0035_transaction_templates.sql
-- Phase F: Transaction Templates. A Template is NOT a transaction and
-- creates NO ledger effect whatsoever — no transactions row, no
-- transaction_entries row, no balance/Budget/report change. It stores
-- reusable DEFAULTS; the actual transaction is only ever created when a
-- user opens the template, reviews/edits the prefilled form, and presses
-- Save — at which point the EXISTING create_income_expense_transaction
-- RPC (0012/0032) runs exactly as it would for a manually-typed entry.
-- V1 supports INCOME/EXPENSE templates only — no Transfer/Refund/
-- Reimbursement templates (those remain out of scope for this phase).

create table public.transaction_templates (
  id uuid primary key default gen_random_uuid(),
  scope public.money_scope not null,
  owner_user_id uuid references public.profiles (id),
  household_id uuid references public.households (id),
  transaction_type public.transaction_type not null,
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored,
  wallet_id uuid references public.wallets (id),
  pocket_id uuid references public.pockets (id),
  category_id uuid references public.categories (id),
  amount numeric(14, 2),
  title text,
  note text,
  archived_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_templates_scope_ownership_chk check (
    (scope = 'PERSONAL' and owner_user_id is not null and household_id is null)
    or
    (scope = 'HOUSEHOLD' and household_id is not null and owner_user_id is null)
  ),
  constraint transaction_templates_type_chk check (transaction_type in ('INCOME', 'EXPENSE')),
  constraint transaction_templates_name_not_blank_chk check (btrim(name) <> ''),
  constraint transaction_templates_name_length_chk check (char_length(name) <= 60),
  constraint transaction_templates_amount_positive_chk check (amount is null or amount > 0),
  constraint transaction_templates_pocket_requires_wallet_chk check (pocket_id is null or wallet_id is not null)
);

comment on table public.transaction_templates is
  'Reusable defaults for creating a future INCOME/EXPENSE transaction. Never itself moves money: no transactions row, no transaction_entries row, no balance/Budget/report effect. All fields except name are optional prefill hints, freely overridable by the user before the real transaction is saved through the normal writer.';
comment on column public.transaction_templates.transaction_type is
  'INCOME or EXPENSE only (transaction_templates_type_chk) — Pocket/Wallet Transfer, Refund, and Reimbursement templates are out of scope for V1.';
comment on column public.transaction_templates.amount is
  'A default only — the user may change it freely before Save. NULL means "no default amount", not zero.';
comment on column public.transaction_templates.wallet_id is
  'Optional saved default. If the Wallet is later archived, the Template stays fully readable/editable; only USE (creating a transaction from it) requires picking an active Wallet instead — see docs/FINANCE.md Phase F.';
comment on column public.transaction_templates.archived_at is
  'NULL = active/usable. Set (never deleted) to retire a Template — an archived Template remains viewable/manageable and can be restored, but cannot be used to create a transaction while archived.';

create index transaction_templates_owner_user_id_idx on public.transaction_templates (owner_user_id) where owner_user_id is not null;
create index transaction_templates_household_id_idx on public.transaction_templates (household_id) where household_id is not null;
create index transaction_templates_wallet_id_idx on public.transaction_templates (wallet_id) where wallet_id is not null;
create index transaction_templates_category_id_idx on public.transaction_templates (category_id) where category_id is not null;

-- Cheap, useful duplicate prevention (not overcomplicated): a normalized
-- name is unique per scope among ACTIVE templates only — an archived
-- template never blocks a new one reusing its name.
create unique index transaction_templates_personal_unique_name_idx on public.transaction_templates (owner_user_id, normalized_name)
  where scope = 'PERSONAL' and archived_at is null;
create unique index transaction_templates_household_unique_name_idx on public.transaction_templates (household_id, normalized_name)
  where scope = 'HOUSEHOLD' and archived_at is null;

create trigger transaction_templates_set_updated_at
  before update on public.transaction_templates
  for each row execute function public.set_updated_at();

-- Identity is frozen after creation, same pattern as every other Money
-- entity: scope/owner/household/created_by never change, and
-- transaction_type is frozen too (changing INCOME<->EXPENSE would
-- invalidate any already-saved category_id, which is simpler to just
-- disallow than to re-validate). name/wallet_id/pocket_id/category_id/
-- amount/title/note remain fully editable — a Template's whole point is
-- that its defaults change over time, unlike Budget's archive-and-
-- recreate-on-identity-change V1 rule.
create trigger transaction_templates_prevent_identity_changes
  before update on public.transaction_templates
  for each row execute function public.prevent_immutable_column_changes(
    'scope', 'owner_user_id', 'household_id', 'created_by', 'transaction_type'
  );

-- Cross-table validation of the three optional references. Deliberately
-- stricter than "the Template merely stays readable if these are
-- archived LATER" — a NEW assignment (at create OR edit time) must
-- target an ACTIVE, scope-compatible Wallet/Pocket/Category, mirroring
-- the same "cannot newly attach an archived thing" rule already
-- established for Categories (Phase B) and Tags (Phase C). Fires only
-- when one of these columns (or the identity columns that change their
-- validity) is actually part of the write, so an amount/title/note-only
-- edit never re-validates an already-saved, possibly-since-archived
-- reference — that reference simply stays as it was, exactly like a
-- historical transaction keeping an archived Category.
create function public.transaction_templates_validate_references()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_pocket public.pockets%rowtype;
  v_category public.categories%rowtype;
begin
  if new.wallet_id is not null then
    select * into v_wallet from public.wallets where id = new.wallet_id;
    if not found then
      raise exception 'Wallet % not found or not accessible', new.wallet_id using errcode = '23503';
    end if;
    if v_wallet.scope <> new.scope
      or v_wallet.owner_user_id is distinct from new.owner_user_id
      or v_wallet.household_id is distinct from new.household_id
    then
      raise exception 'Wallet % does not belong to the same owner/household as this Template', new.wallet_id
        using errcode = '23514';
    end if;
    if v_wallet.is_archived then
      raise exception 'Wallet % is archived and cannot be saved as a Template default', new.wallet_id
        using errcode = '23514';
    end if;
  end if;

  if new.pocket_id is not null then
    select * into v_pocket from public.pockets where id = new.pocket_id;
    if not found then
      raise exception 'Pocket % not found or not accessible', new.pocket_id using errcode = '23503';
    end if;
    if v_pocket.wallet_id is distinct from new.wallet_id then
      raise exception 'Pocket % does not belong to Wallet %', new.pocket_id, new.wallet_id using errcode = '23514';
    end if;
    if v_pocket.is_archived then
      raise exception 'Pocket % is archived and cannot be saved as a Template default', new.pocket_id
        using errcode = '23514';
    end if;
  end if;

  if new.category_id is not null then
    select * into v_category from public.categories where id = new.category_id;
    if not found then
      raise exception 'Category % not found or not accessible', new.category_id using errcode = '23503';
    end if;
    if v_category.transaction_type::text <> new.transaction_type::text then
      raise exception 'Category % is a % category and cannot be used for a % Template',
        new.category_id, v_category.transaction_type, new.transaction_type
        using errcode = '23514';
    end if;
    if v_category.archived_at is not null then
      raise exception 'Category % is archived and cannot be saved as a Template default', new.category_id
        using errcode = '23514';
    end if;
    if not v_category.is_system and (
      v_category.scope <> new.scope
      or v_category.owner_user_id is distinct from new.owner_user_id
      or v_category.household_id is distinct from new.household_id
    ) then
      raise exception 'Category % does not belong to the same owner/household as this Template', new.category_id
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.transaction_templates_validate_references() is
  'Rejects newly assigning an archived or scope-incompatible Wallet/Pocket/Category to a Template, and rejects a Category whose transaction_type does not match. Fires only when wallet_id/pocket_id/category_id (or an identity column) actually changes — an already-saved, later-archived reference is never re-validated by an unrelated edit.';

create trigger transaction_templates_before_write_validate
  before insert or update of wallet_id, pocket_id, category_id, transaction_type, scope, owner_user_id, household_id
  on public.transaction_templates
  for each row execute function public.transaction_templates_validate_references();

alter table public.transaction_templates enable row level security;

-- Same PERSONAL-owner / HOUSEHOLD-member policy as every other Money
-- planning entity (Category, Tag, Budget) — member-level, not
-- owner/admin-gated.
create policy transaction_templates_select
  on public.transaction_templates for select
  using (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  );

create policy transaction_templates_insert
  on public.transaction_templates for insert
  with check (
    created_by = auth.uid()
    and (
      (scope = 'PERSONAL' and owner_user_id = auth.uid())
      or
      (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
    )
  );

create policy transaction_templates_update
  on public.transaction_templates for update
  using (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  )
  with check (
    (scope = 'PERSONAL' and owner_user_id = auth.uid())
    or
    (scope = 'HOUSEHOLD' and public.is_household_member(household_id))
  );

-- No delete policy/grant: hard delete is not part of V1 (archive instead).

grant select, insert, update on public.transaction_templates to authenticated;

-- ---------------------------------------------------------------------
-- transaction_template_tags (join table). Locked down the same way as
-- transaction_tags (0032): no direct INSERT/UPDATE/DELETE grant to
-- authenticated at all, only SELECT — every write goes through
-- set_template_tags below. Templates carry no financial stakes of their
-- own, but this keeps exactly one tag-association pattern in the
-- codebase instead of a second, differently-shaped one.
-- ---------------------------------------------------------------------

create table public.transaction_template_tags (
  template_id uuid not null references public.transaction_templates (id) on delete cascade,
  tag_id uuid not null references public.tags (id),
  created_at timestamptz not null default now(),
  primary key (template_id, tag_id)
);

comment on table public.transaction_template_tags is
  'Many-to-many Template<->Tag association. Write-only through set_template_tags (SECURITY DEFINER) — never a direct client INSERT/DELETE.';

create index transaction_template_tags_template_id_idx on public.transaction_template_tags (template_id);
create index transaction_template_tags_tag_id_idx on public.transaction_template_tags (tag_id);

alter table public.transaction_template_tags enable row level security;

create policy transaction_template_tags_select
  on public.transaction_template_tags for select
  using (
    exists (
      select 1 from public.transaction_templates t
      where t.id = transaction_template_tags.template_id
        and (
          (t.scope = 'PERSONAL' and t.owner_user_id = auth.uid())
          or
          (t.scope = 'HOUSEHOLD' and public.is_household_member(t.household_id))
        )
    )
  );

grant select on public.transaction_template_tags to authenticated;

-- ---------------------------------------------------------------------
-- set_template_tags: the one tag-association RPC for Templates. Unlike
-- Phase C's split (assign_transaction_tags + set_transaction_tags), one
-- function is enough here — Templates have no equivalent of "create the
-- parent row and attach tags atomically from three different create_*
-- RPCs" to share logic with (template creation is a plain INSERT, tags
-- are attached in a deliberately separate step — see docs/FINANCE.md
-- Phase F "Tag handling" for why a lower atomicity bar than Phase C's
-- transactions is acceptable here: a Template carries no accounting
-- stakes, so a create-succeeded-but-tags-failed gap is a minor UX rough
-- edge, never a correctness bug).
-- ---------------------------------------------------------------------

create function public.set_template_tags(p_template_id uuid, p_tag_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.transaction_templates%rowtype;
  v_authorized boolean;
  v_unique_tag_ids uuid[];
  v_tag_id uuid;
  v_tag public.tags%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_template from public.transaction_templates where id = p_template_id;
  if not found then
    raise exception 'Template % not found or not authorized', p_template_id using errcode = '42501';
  end if;

  if v_template.scope = 'PERSONAL' then
    v_authorized := v_template.owner_user_id = auth.uid();
  else
    v_authorized := public.is_household_member(v_template.household_id);
  end if;
  if not v_authorized then
    raise exception 'Template % not found or not authorized', p_template_id using errcode = '42501';
  end if;

  select array(select distinct unnest(coalesce(p_tag_ids, array[]::uuid[]))) into v_unique_tag_ids;

  foreach v_tag_id in array v_unique_tag_ids loop
    select * into v_tag from public.tags where id = v_tag_id;
    if not found then
      raise exception 'Tag % not found or not accessible', v_tag_id using errcode = 'P0002';
    end if;
    if v_tag.archived_at is not null then
      raise exception 'Tag % is archived and cannot be attached', v_tag_id using errcode = '23514';
    end if;
    if v_tag.scope <> v_template.scope
      or (v_template.scope = 'PERSONAL' and v_tag.owner_user_id is distinct from v_template.owner_user_id)
      or (v_template.scope = 'HOUSEHOLD' and v_tag.household_id is distinct from v_template.household_id)
    then
      raise exception 'Tag % does not belong to the same owner/household as Template %', v_tag_id, p_template_id
        using errcode = '23514';
    end if;
  end loop;

  delete from public.transaction_template_tags where template_id = p_template_id;

  insert into public.transaction_template_tags (template_id, tag_id)
  select p_template_id, t from unnest(v_unique_tag_ids) as t;

  return p_template_id;
end;
$$;

comment on function public.set_template_tags(uuid, uuid[]) is
  'SECURITY DEFINER: replaces a Template''s tag set atomically (validate every tag first, then delete+reinsert). Rejects an archived or scope-incompatible tag. No financial effect — Templates carry no ledger stakes.';

revoke execute on function public.set_template_tags(uuid, uuid[]) from public, anon;
grant execute on function public.set_template_tags(uuid, uuid[]) to authenticated;
