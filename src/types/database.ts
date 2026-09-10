/**
 * Hand-authored to mirror `supabase/migrations/*.sql` exactly, because no
 * live Supabase project is linked in this environment to run
 * `supabase gen types typescript`. Once one exists, regenerate this file
 * with:
 *
 *   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts
 *
 * and delete this note. Keep this file in sync with the migrations until
 * then — it is the only thing standing between a schema typo and a runtime
 * error, since there is no ORM.
 */

export type MoneyScope = "PERSONAL" | "HOUSEHOLD";
export type HouseholdRole = "owner" | "admin" | "member";
export type WalletType = "BANK" | "CASH" | "CREDIT_CARD" | "E_WALLET" | "OTHER";
export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER" | "DEBT_PRINCIPAL";
export type CategoryTransactionType = "INCOME" | "EXPENSE";
export type ExpenseAdjustmentKind = "REFUND" | "REIMBURSEMENT";
export type ProfileGender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
export type PetSpecies = "CAT" | "DOG" | "RABBIT" | "BIRD" | "FISH" | "OTHER";
export type PetSex = "MALE" | "FEMALE" | "UNKNOWN";
export type CalendarEventScope = "PERSONAL" | "HOUSEHOLD";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string;
          avatar_url: string | null;
          gender: ProfileGender | null;
          birthday: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // created only by the handle_new_user trigger
        Update: {
          display_name?: string;
          avatar_url?: string | null;
          gender?: ProfileGender | null;
          birthday?: string | null;
        };
        Relationships: [];
      };
      households: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: HouseholdRole;
          member_color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role?: HouseholdRole;
          member_color?: string;
        };
        Update: {
          role?: HouseholdRole;
          member_color?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "household_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pets: {
        Row: { id: string; household_id: string; name: string; species: PetSpecies; breed: string | null; sex: PetSex | null; birthday: string | null; photo_path: string | null; archived_at: string | null; created_by: string; created_at: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      pet_caregivers: {
        Row: { pet_id: string; household_member_id: string; household_id: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      calendar_events: {
        Row: { id:string; household_id:string|null; created_by:string; title:string; note:string|null; scope:CalendarEventScope; starts_at:string|null; ends_at:string|null; is_all_day:boolean; all_day_date:string|null; archived_at:string|null; created_at:string; updated_at:string };
        Insert: never; Update: never; Relationships: [];
      };
      calendar_event_participants: {
        Row: { event_id:string; household_member_id:string; household_id:string; created_at:string };
        Insert: never; Update: never; Relationships: [];
      };
      wallets: {
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          name: string;
          wallet_type: WalletType;
          currency: string;
          icon: string | null;
          is_archived: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scope: MoneyScope;
          owner_user_id?: string | null;
          household_id?: string | null;
          name: string;
          wallet_type?: WalletType;
          currency?: string;
          icon?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          wallet_type?: WalletType;
          icon?: string | null;
          is_archived?: boolean;
          /** Rejected by the DB (0030) once this wallet has any transaction history. */
          currency?: string;
        };
        Relationships: [];
      };
      pockets: {
        Row: {
          id: string;
          wallet_id: string;
          name: string;
          icon: string | null;
          sort_order: number;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          name: string;
          icon?: string | null;
          sort_order?: number;
          is_archived?: boolean;
        };
        Update: {
          name?: string;
          icon?: string | null;
          sort_order?: number;
          is_archived?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "pockets_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          scope: MoneyScope | null;
          owner_user_id: string | null;
          household_id: string | null;
          name: string;
          transaction_type: CategoryTransactionType;
          parent_id: string | null;
          icon: string | null;
          sort_order: number;
          is_system: boolean;
          archived_at: string | null;
          created_by: string | null;
          system_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scope: MoneyScope;
          owner_user_id?: string | null;
          household_id?: string | null;
          name: string;
          transaction_type: CategoryTransactionType;
          parent_id?: string | null;
          icon?: string | null;
          sort_order?: number;
          created_by: string;
        };
        Update: {
          name?: string;
          icon?: string | null;
          sort_order?: number;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          transaction_type: TransactionType;
          category_id: string | null;
          title: string | null;
          note: string | null;
          occurred_at: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
        };
        Insert: never; // created only via the create_* RPC functions
        Update: never; // mutated only via the update_/void_/restore_ RPC functions (0031)
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      transaction_entries: {
        Row: {
          id: string;
          transaction_id: string;
          wallet_id: string;
          pocket_id: string;
          amount: string | number; // PostgREST runtime shape varies by numeric parser/query path
          created_at: string;
        };
        Insert: never; // created only via the create_* RPC functions
        Update: never; // immutable ledger lines
        Relationships: [
          {
            foreignKeyName: "transaction_entries_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_entries_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_entries_pocket_id_fkey";
            columns: ["pocket_id"];
            isOneToOne: false;
            referencedRelation: "pockets";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          name: string;
          normalized_name: string;
          archived_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scope: MoneyScope;
          owner_user_id?: string | null;
          household_id?: string | null;
          name: string;
          created_by: string;
        };
        Update: {
          name?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      transaction_tags: {
        Row: {
          transaction_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: never; // created only via set_transaction_tags / the create_* RPC functions
        Update: never; // replace-only, via set_transaction_tags
        Relationships: [
          {
            foreignKeyName: "transaction_tags_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_adjustments: {
        Row: {
          transaction_id: string;
          original_expense_transaction_id: string;
          adjustment_kind: ExpenseAdjustmentKind;
          created_at: string;
        };
        Insert: never; // created only via create_expense_adjustment_transaction
        Update: never; // immutable — void/restore the transaction instead
        Relationships: [
          {
            foreignKeyName: "expense_adjustments_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: true;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expense_adjustments_original_expense_transaction_id_fkey";
            columns: ["original_expense_transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      budgets: {
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          category_id: string;
          currency: string;
          period_month: string;
          amount: string | number;
          archived_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scope: MoneyScope;
          owner_user_id?: string | null;
          household_id?: string | null;
          category_id: string;
          currency: string;
          period_month: string;
          amount: string;
          created_by: string;
        };
        Update: {
          amount?: string;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      transaction_templates: {
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          transaction_type: "INCOME" | "EXPENSE";
          name: string;
          normalized_name: string;
          wallet_id: string | null;
          pocket_id: string | null;
          category_id: string | null;
          amount: string | number | null;
          title: string | null;
          note: string | null;
          archived_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scope: MoneyScope;
          owner_user_id?: string | null;
          household_id?: string | null;
          transaction_type: "INCOME" | "EXPENSE";
          name: string;
          wallet_id?: string | null;
          pocket_id?: string | null;
          category_id?: string | null;
          amount?: string | null;
          title?: string | null;
          note?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          wallet_id?: string | null;
          pocket_id?: string | null;
          category_id?: string | null;
          amount?: string | null;
          title?: string | null;
          note?: string | null;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_templates_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_templates_pocket_id_fkey";
            columns: ["pocket_id"];
            isOneToOne: false;
            referencedRelation: "pockets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_templates_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      transaction_template_tags: {
        Row: {
          template_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: never; // created only via set_template_tags
        Update: never; // replace-only, via set_template_tags
        Relationships: [
          {
            foreignKeyName: "transaction_template_tags_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "transaction_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_template_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_transactions: {
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          transaction_type: "INCOME" | "EXPENSE";
          name: string;
          wallet_id: string | null;
          pocket_id: string | null;
          category_id: string | null;
          amount: string | number;
          title: string | null;
          note: string | null;
          frequency: "WEEKLY" | "MONTHLY" | "YEARLY";
          interval_count: number;
          start_date: string;
          end_date: string | null;
          anchor_day: number;
          paused_at: string | null;
          archived_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scope: MoneyScope;
          owner_user_id?: string | null;
          household_id?: string | null;
          transaction_type: "INCOME" | "EXPENSE";
          name: string;
          wallet_id?: string | null;
          pocket_id?: string | null;
          category_id?: string | null;
          amount: string | number;
          title?: string | null;
          note?: string | null;
          frequency: "WEEKLY" | "MONTHLY" | "YEARLY";
          interval_count?: number;
          start_date: string;
          end_date?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          wallet_id?: string | null;
          pocket_id?: string | null;
          category_id?: string | null;
          amount?: string | number;
          title?: string | null;
          note?: string | null;
          frequency?: "WEEKLY" | "MONTHLY" | "YEARLY";
          interval_count?: number;
          start_date?: string;
          end_date?: string | null;
          paused_at?: string | null;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_transactions_pocket_id_fkey";
            columns: ["pocket_id"];
            isOneToOne: false;
            referencedRelation: "pockets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_occurrences: {
        Row: {
          id: string;
          recurring_transaction_id: string;
          due_date: string;
          status: "UPCOMING" | "POSTED" | "SKIPPED";
          posted_transaction_id: string | null;
          posted_at: string | null;
          skipped_at: string | null;
          created_at: string;
        };
        Insert: never; // created only via materialize_recurring_occurrences
        Update: never; // transitioned only via post_recurring_occurrence / skip_recurring_occurrence
        Relationships: [
          {
            foreignKeyName: "recurring_occurrences_recurring_transaction_id_fkey";
            columns: ["recurring_transaction_id"];
            isOneToOne: false;
            referencedRelation: "recurring_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_occurrences_posted_transaction_id_fkey";
            columns: ["posted_transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_transaction_tags: {
        Row: {
          recurring_transaction_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: never; // created only via set_recurring_transaction_tags
        Update: never; // replace-only, via set_recurring_transaction_tags
        Relationships: [
          {
            foreignKeyName: "recurring_transaction_tags_recurring_transaction_id_fkey";
            columns: ["recurring_transaction_id"];
            isOneToOne: false;
            referencedRelation: "recurring_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_transaction_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      bills: {
        Row: { id:string; scope:MoneyScope; owner_user_id:string|null; household_id:string|null; name:string; amount:string|number; currency:string; wallet_id:string|null; pocket_id:string|null; category_id:string; title:string|null; note:string|null; recurrence_type:"ONE_TIME"|"WEEKLY"|"MONTHLY"|"YEARLY"; interval_count:number; start_date:string; end_date:string|null; anchor_day:number; paused_at:string|null; archived_at:string|null; created_by:string; created_at:string; updated_at:string };
        Insert: { id?:string; scope:MoneyScope; owner_user_id?:string|null; household_id?:string|null; name:string; amount:string|number; currency:string; wallet_id?:string|null; pocket_id?:string|null; category_id:string; title?:string|null; note?:string|null; recurrence_type:"ONE_TIME"|"WEEKLY"|"MONTHLY"|"YEARLY"; interval_count?:number; start_date:string; end_date?:string|null; created_by:string };
        Update: { name?:string; amount?:string|number; wallet_id?:string|null; pocket_id?:string|null; category_id?:string; title?:string|null; note?:string|null; recurrence_type?:"ONE_TIME"|"WEEKLY"|"MONTHLY"|"YEARLY"; interval_count?:number; start_date?:string; end_date?:string|null; paused_at?:string|null; archived_at?:string|null };
        Relationships: [];
      };
      bill_occurrences: {
        Row: { id:string; bill_id:string; due_date:string; expected_amount:string|number; status:"OPEN"|"PAID"|"SKIPPED"; paid_transaction_id:string|null; paid_at:string|null; skipped_at:string|null; created_at:string };
        Insert: never; Update: never; Relationships: [];
      };
      bill_tags: {
        Row: { bill_id:string; tag_id:string; created_at:string }; Insert:never; Update:never; Relationships:[];
      };
      installment_plans:{Row:{id:string;scope:MoneyScope;owner_user_id:string|null;household_id:string|null;name:string;total_amount:string|number;currency:string;installment_count:number;start_date:string;interval_months:number;wallet_id:string|null;pocket_id:string|null;category_id:string;title:string|null;note:string|null;archived_at:string|null;created_by:string;created_at:string;updated_at:string};Insert:{id?:string;scope:MoneyScope;owner_user_id?:string|null;household_id?:string|null;name:string;total_amount:string|number;currency:string;installment_count:number;start_date:string;interval_months?:number;wallet_id?:string|null;pocket_id?:string|null;category_id:string;title?:string|null;note?:string|null;created_by:string};Update:{name?:string;wallet_id?:string|null;pocket_id?:string|null;category_id?:string;title?:string|null;note?:string|null;archived_at?:string|null};Relationships:[]};
      installment_occurrences:{Row:{id:string;plan_id:string;sequence_number:number;due_date:string;expected_amount:string|number;status:"OPEN"|"PAID";paid_transaction_id:string|null;paid_at:string|null;created_at:string};Insert:never;Update:never;Relationships:[]};
      saving_goals:{Row:{id:string;scope:MoneyScope;owner_user_id:string|null;household_id:string|null;name:string;target_amount:string|number;linked_pocket_id:string;target_date:string|null;note:string|null;archived_at:string|null;created_by:string;created_at:string;updated_at:string};Insert:{id?:string;scope:MoneyScope;owner_user_id?:string|null;household_id?:string|null;name:string;target_amount:string|number;linked_pocket_id:string;target_date?:string|null;note?:string|null;created_by:string};Update:{name?:string;target_amount?:string|number;linked_pocket_id?:string;target_date?:string|null;note?:string|null;archived_at?:string|null};Relationships:[]};
      debt_accounts:{Row:{id:string;scope:MoneyScope;owner_user_id:string|null;household_id:string|null;debt_type:"LIABILITY"|"RECEIVABLE";name:string;counterparty:string|null;currency:string;apr:string|number|null;due_date:string|null;note:string|null;archived_at:string|null;created_by:string;created_at:string;updated_at:string};Insert:never;Update:{name?:string;counterparty?:string|null;apr?:string|number|null;due_date?:string|null;note?:string|null;archived_at?:string|null};Relationships:[]};
      debt_events:{Row:{id:string;debt_account_id:string;event_kind:"DRAW"|"PRINCIPAL_REPAYMENT"|"DISBURSEMENT"|"PRINCIPAL_RECEIPT";principal_amount:string|number;principal_transaction_id:string;interest_transaction_id:string|null;created_by:string;created_at:string};Insert:never;Update:never;Relationships:[]};
      transaction_attachments:{Row:{id:string;transaction_id:string;storage_path:string;mime_type:string;file_name:string;file_size:number;created_by:string;created_at:string};Insert:{id:string;transaction_id:string;storage_path:string;mime_type:string;file_name:string;file_size:number;created_by:string};Update:never;Relationships:[]};
    };
    Views: Record<string, never>;
    Functions: {
      is_household_member: {
        Args: { p_household_id: string };
        Returns: boolean;
      };
      has_household_role: {
        Args: { p_household_id: string; p_roles: HouseholdRole[] };
        Returns: boolean;
      };
      add_household_member: {
        Args: { p_household_id: string; p_email: string; p_role?: HouseholdRole };
        Returns: Database["public"]["Tables"]["household_members"]["Row"];
      };
      update_member_presentation: {
        Args: { p_household_id: string; p_display_name: string; p_member_color: string };
        Returns: Database["public"]["Tables"]["household_members"]["Row"];
      };
      change_household_member_role: {
        Args: { p_household_id: string; p_member_id: string; p_role: "admin" | "member" };
        Returns: Database["public"]["Tables"]["household_members"]["Row"];
      };
      get_own_profile: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      update_profile_details: {
        Args: {
          p_household_id: string;
          p_display_name: string;
          p_gender: ProfileGender | null;
          p_birthday: string | null;
          p_member_color: string;
          p_avatar_url: string | null;
        };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      create_pet: {
        Args: { p_id: string; p_household_id: string; p_name: string; p_species: PetSpecies; p_breed: string | null; p_sex: PetSex | null; p_birthday: string | null; p_photo_path: string | null; p_caregiver_member_ids: string[] };
        Returns: Database["public"]["Tables"]["pets"]["Row"];
      };
      update_pet: {
        Args: { p_pet_id: string; p_name: string; p_species: PetSpecies; p_breed: string | null; p_sex: PetSex | null; p_birthday: string | null; p_photo_path: string | null; p_caregiver_member_ids: string[] };
        Returns: Database["public"]["Tables"]["pets"]["Row"];
      };
      set_pet_archived: {
        Args: { p_pet_id: string; p_archived: boolean };
        Returns: Database["public"]["Tables"]["pets"]["Row"];
      };
      create_calendar_event: {
        Args: { p_id:string; p_scope:CalendarEventScope; p_household_id:string|null; p_title:string; p_note:string|null; p_is_all_day:boolean; p_all_day_date:string|null; p_starts_at:string|null; p_ends_at:string|null; p_member_ids:string[] };
        Returns: Database["public"]["Tables"]["calendar_events"]["Row"];
      };
      update_calendar_event: {
        Args: { p_event_id:string; p_title:string; p_note:string|null; p_is_all_day:boolean; p_all_day_date:string|null; p_starts_at:string|null; p_ends_at:string|null; p_member_ids:string[] };
        Returns: Database["public"]["Tables"]["calendar_events"]["Row"];
      };
      set_calendar_event_archived: {
        Args: { p_event_id:string; p_archived:boolean };
        Returns: Database["public"]["Tables"]["calendar_events"]["Row"];
      };
      get_finance_hub_summary: {
        Args: { p_month_start: string; p_month_end: string };
        Returns: unknown;
      };
      get_pocket_balance: {
        Args: { p_pocket_id: string };
        Returns: string | number;
      };
      get_wallet_balance: {
        Args: { p_wallet_id: string };
        Returns: string | number;
      };
      create_wallet_with_first_pocket: {
        Args: {
          p_scope: "PERSONAL" | "HOUSEHOLD";
          p_owner_user_id: string | null;
          p_household_id: string | null;
          p_name: string;
          p_wallet_type: "BANK" | "CASH" | "CREDIT_CARD" | "E_WALLET" | "OTHER";
          p_currency: string;
          p_first_pocket_name: string;
        };
        Returns: Database["public"]["Tables"]["wallets"]["Row"];
      };
      create_income_expense_transaction: {
        Args: {
          p_transaction_type: "INCOME" | "EXPENSE";
          p_wallet_id: string;
          p_pocket_id: string;
          p_category_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string;
          p_tag_ids?: string[] | null;
        };
        Returns: string;
      };
      create_pocket_transfer: {
        Args: {
          p_wallet_id: string;
          p_from_pocket_id: string;
          p_to_pocket_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string;
          p_tag_ids?: string[] | null;
        };
        Returns: string;
      };
      create_wallet_transfer: {
        Args: {
          p_from_wallet_id: string;
          p_from_pocket_id: string;
          p_to_wallet_id: string;
          p_to_pocket_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string;
          p_tag_ids?: string[] | null;
        };
        Returns: string;
      };
      is_transaction_authorized: {
        Args: { p_transaction_id: string };
        Returns: boolean;
      };
      update_income_expense_transaction: {
        Args: {
          p_transaction_id: string;
          p_pocket_id: string;
          p_category_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string;
          p_tag_ids?: string[] | null;
        };
        Returns: string;
      };
      void_transaction: {
        Args: { p_transaction_id: string; p_void_reason?: string | null };
        Returns: string;
      };
      restore_transaction: {
        Args: { p_transaction_id: string };
        Returns: string;
      };
      set_transaction_tags: {
        Args: { p_transaction_id: string; p_tag_ids: string[] | null };
        Returns: string;
      };
      get_expense_adjustment_total: {
        Args: { p_original_expense_transaction_id: string };
        Returns: string | number;
      };
      get_expense_refundable_summary: {
        Args: { p_transaction_id: string };
        Returns: unknown;
      };
      create_expense_adjustment_transaction: {
        Args: {
          p_original_expense_id: string;
          p_adjustment_kind: ExpenseAdjustmentKind;
          p_wallet_id: string;
          p_pocket_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string;
          p_tag_ids?: string[] | null;
        };
        Returns: string;
      };
      get_budget_summary: {
        Args: { p_period_month: string; p_month_start: string; p_month_end: string };
        Returns: unknown;
      };
      set_template_tags: {
        Args: { p_template_id: string; p_tag_ids: string[] | null };
        Returns: string;
      };
      recurring_next_due_date: {
        Args: { p_prev: string; p_start: string; p_frequency: string; p_interval_count: number; p_anchor_day: number | null };
        Returns: string;
      };
      materialize_recurring_occurrences: {
        Args: { p_scope: MoneyScope; p_household_id?: string | null };
        Returns: undefined;
      };
      set_recurring_transaction_tags: {
        Args: { p_recurring_id: string; p_tag_ids: string[] | null };
        Returns: string;
      };
      post_recurring_occurrence: {
        Args: {
          p_occurrence_id: string;
          p_wallet_id: string;
          p_pocket_id: string;
          p_category_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string;
          p_tag_ids?: string[] | null;
        };
        Returns: string;
      };
      skip_recurring_occurrence: {
        Args: { p_occurrence_id: string };
        Returns: string;
      };
      materialize_bill_occurrences: { Args:{ p_scope:MoneyScope; p_household_id?:string|null }; Returns:undefined };
      set_bill_tags: { Args:{ p_bill_id:string; p_tag_ids:string[]|null }; Returns:string };
      skip_bill_occurrence: { Args:{ p_occurrence_id:string }; Returns:string };
      pay_bill_occurrence: { Args:{ p_occurrence_id:string; p_wallet_id:string; p_pocket_id:string; p_category_id:string; p_amount:string; p_title?:string|null; p_note?:string|null; p_occurred_at?:string|null; p_tag_ids?:string[]|null }; Returns:string };
      pay_installment_occurrence:{Args:{p_occurrence_id:string;p_wallet_id:string;p_pocket_id:string;p_category_id:string;p_amount:string;p_title?:string|null;p_note?:string|null;p_occurred_at?:string|null;p_tag_ids?:string[]|null};Returns:string};
      get_saving_goal_progress:{Args:{p_scope:MoneyScope;p_household_id?:string|null};Returns:unknown};
      create_debt_account:{Args:{p_scope:MoneyScope;p_household_id:string|null;p_debt_type:"LIABILITY"|"RECEIVABLE";p_name:string;p_counterparty:string|null;p_currency:string;p_opening_principal:string;p_wallet_id:string;p_pocket_id:string;p_apr?:string|null;p_due_date?:string|null;p_note?:string|null;p_occurred_at?:string|null};Returns:string};
      record_debt_payment:{Args:{p_debt_id:string;p_wallet_id:string;p_pocket_id:string;p_principal:string;p_interest:string;p_interest_category_id:string;p_title?:string|null;p_note?:string|null;p_occurred_at?:string|null;p_tag_ids?:string[]|null};Returns:string};
      record_additional_debt_principal:{Args:{p_debt_id:string;p_wallet_id:string;p_pocket_id:string;p_principal:string;p_title?:string|null;p_note?:string|null;p_occurred_at?:string|null};Returns:string};
      debt_outstanding:{Args:{p_debt_id:string};Returns:string|number};
      get_debt_summary:{Args:{p_scope:MoneyScope;p_household_id?:string|null};Returns:unknown};
      get_finance_reports:{Args:{p_scope:MoneyScope;p_household_id:string|null;p_start:string;p_end:string};Returns:unknown};
      get_calendar_finance_items:{Args:{p_start:string;p_end:string};Returns:unknown};
      import_finance_transactions:{Args:{p_rows:unknown};Returns:number};
      get_finance_export:{Args:{p_from:string|null;p_to:string|null;p_wallet_id:string|null;p_pocket_id:string|null;p_category_id:string|null;p_type:TransactionType|null;p_tag_id:string|null};Returns:unknown};
      get_net_worth:{Args:Record<string,never>;Returns:unknown};
      get_finance_insights:{Args:{p_current_start:string;p_current_end:string;p_previous_start:string;p_today:string};Returns:unknown};
      get_finance_hub_final:{Args:{p_report_start:string;p_report_end:string;p_today:string};Returns:unknown};
    };
    Enums: {
      household_role: HouseholdRole;
      money_scope: MoneyScope;
      wallet_type: WalletType;
      transaction_type: TransactionType;
      category_transaction_type: CategoryTransactionType;
      expense_adjustment_kind: ExpenseAdjustmentKind;
      profile_gender: ProfileGender;
      pet_species: PetSpecies;
      pet_sex: PetSex;
      calendar_event_scope: CalendarEventScope;
    };
    CompositeTypes: Record<string, never>;
  };
}
