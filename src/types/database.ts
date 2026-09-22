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
export type HouseholdRole = "owner" | "admin" | "member" | "observer";
export type WalletType = "BANK" | "CASH" | "CREDIT_CARD" | "E_WALLET" | "OTHER";
export type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "DEBT_PRINCIPAL"
  | "CARD_ADJUSTMENT"
  | "OPENING_BALANCE";
export type CategoryTransactionType = "INCOME" | "EXPENSE";
export type ExpenseAdjustmentKind = "REFUND" | "REIMBURSEMENT";
export type ProfileGender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
export type PetSpecies = "CAT" | "DOG" | "RABBIT" | "BIRD" | "FISH" | "OTHER";
export type PetSex = "MALE" | "FEMALE" | "UNKNOWN";
export type PetCareRecordType =
  | "HEALTH"
  | "VACCINE"
  | "MEDICATION"
  | "VET"
  | "WEIGHT"
  | "EXPENSE"
  | "DOCUMENT";
export type CalendarEventScope = "PERSONAL" | "HOUSEHOLD";
export type PlanTaskPriority = "LOW" | "NORMAL" | "HIGH";
export type PlanNoteColor =
  "SAGE" | "SKY" | "SAND" | "ROSE" | "LILAC" | "WHITE";
export type PlanReminderRecurrence =
  "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type ChoreCadence = "DAILY" | "WEEKLY";
export type InventoryCategory =
  "MEDICINE" | "PET_SUPPLY" | "HOUSEHOLD" | "FOOD" | "WARRANTY" | "OTHER";
export type InventoryDocumentType = "RECEIPT" | "MANUAL" | "WARRANTY" | "OTHER";

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
          share_birthday_with_household: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // created only by the handle_new_user trigger
        Update: {
          display_name?: string;
          avatar_url?: string | null;
          gender?: ProfileGender | null;
          birthday?: string | null;
          share_birthday_with_household?: boolean;
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
      notification_preferences: {
        Row: {
          user_id: string;
          plan_enabled: boolean;
          pets_enabled: boolean;
          finance_enabled: boolean;
          inventory_enabled: boolean;
          day_before_enabled: boolean;
          due_day_enabled: boolean;
          member_birthdays_enabled: boolean;
          pet_birthdays_enabled: boolean;
          birthday_week_before_enabled: boolean;
          digest_mode_enabled: boolean;
          daily_digest_enabled: boolean;
          weekly_digest_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan_enabled?: boolean;
          pets_enabled?: boolean;
          finance_enabled?: boolean;
          inventory_enabled?: boolean;
          day_before_enabled?: boolean;
          due_day_enabled?: boolean;
          member_birthdays_enabled?: boolean;
          pet_birthdays_enabled?: boolean;
          birthday_week_before_enabled?: boolean;
          digest_mode_enabled?: boolean;
          daily_digest_enabled?: boolean;
          weekly_digest_enabled?: boolean;
        };
        Update: {
          plan_enabled?: boolean;
          pets_enabled?: boolean;
          finance_enabled?: boolean;
          inventory_enabled?: boolean;
          day_before_enabled?: boolean;
          due_day_enabled?: boolean;
          member_birthdays_enabled?: boolean;
          pet_birthdays_enabled?: boolean;
          birthday_week_before_enabled?: boolean;
          digest_mode_enabled?: boolean;
          daily_digest_enabled?: boolean;
          weekly_digest_enabled?: boolean;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          user_agent: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          user_agent?: string | null;
        };
        Update: {
          user_id?: string;
          p256dh?: string;
          auth_key?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      pets: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          species: PetSpecies;
          breed: string | null;
          sex: PetSex | null;
          birthday: string | null;
          photo_path: string | null;
          archived_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      shopping_items: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          note: string | null;
          store: string | null;
          quantity: string | number;
          unit: string | null;
          estimated_amount: string | number | null;
          currency: string;
          assigned_member_id: string | null;
          created_by: string;
          purchased_at: string | null;
          purchased_by: string | null;
          expense_transaction_id: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      inventory_items: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          category: InventoryCategory;
          note: string | null;
          quantity: string | number;
          unit: string | null;
          restock_threshold: string | number | null;
          expiry_date: string | null;
          warranty_expires_on: string | null;
          purchase_date: string | null;
          location: string | null;
          estimated_restock_amount: string | number | null;
          currency: string;
          shopping_item_id: string | null;
          created_by: string;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      inventory_documents: {
        Row: {
          id: string;
          item_id: string;
          household_id: string;
          document_type: InventoryDocumentType;
          title: string;
          storage_path: string;
          mime_type: string;
          file_size: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          household_id: string;
          document_type?: InventoryDocumentType;
          title: string;
          storage_path: string;
          mime_type: string;
          file_size: number;
          created_by: string;
        };
        Update: never;
        Relationships: [];
      };
      chore_templates: {
        Row: {
          id: string;
          household_id: string;
          title: string;
          details: string | null;
          cadence: ChoreCadence;
          starts_on: string;
          due_time: string | null;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      chore_template_assignees: {
        Row: {
          template_id: string;
          household_id: string;
          member_id: string;
          position: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      chore_occurrences: {
        Row: {
          id: string;
          template_id: string;
          household_id: string;
          due_date: string;
          assigned_member_id: string;
          original_assigned_member_id: string;
          taken_over_by: string | null;
          completed_by: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      pet_caregivers: {
        Row: {
          pet_id: string;
          household_member_id: string;
          household_id: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      pet_care_records: {
        Row: {
          id: string;
          pet_id: string;
          household_id: string;
          created_by: string;
          record_type: PetCareRecordType;
          title: string;
          note: string | null;
          recorded_at: string;
          scheduled_at: string | null;
          value: string | number | null;
          unit: string | null;
          provider: string | null;
          transaction_id: string | null;
          document_path: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pet_id: string;
          household_id: string;
          created_by: string;
          record_type: PetCareRecordType;
          title: string;
          note?: string | null;
          recorded_at?: string;
          scheduled_at?: string | null;
          value?: string | number | null;
          unit?: string | null;
          provider?: string | null;
          transaction_id?: string | null;
          document_path?: string | null;
          archived_at?: string | null;
        };
        Update: {
          record_type?: PetCareRecordType;
          title?: string;
          note?: string | null;
          recorded_at?: string;
          scheduled_at?: string | null;
          value?: string | number | null;
          unit?: string | null;
          provider?: string | null;
          transaction_id?: string | null;
          document_path?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      calendar_events: {
        Row: {
          id: string;
          household_id: string | null;
          created_by: string;
          title: string;
          note: string | null;
          scope: CalendarEventScope;
          starts_at: string | null;
          ends_at: string | null;
          is_all_day: boolean;
          all_day_date: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      calendar_event_participants: {
        Row: {
          event_id: string;
          household_member_id: string;
          household_id: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      plan_tasks: {
        Row: {
          id: string;
          household_id: string | null;
          created_by: string;
          scope: CalendarEventScope;
          title: string;
          details: string | null;
          list_name: string;
          due_date: string | null;
          due_time: string | null;
          priority: PlanTaskPriority;
          is_completed: boolean;
          completed_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string | null;
          created_by: string;
          scope: CalendarEventScope;
          title: string;
          details?: string | null;
          list_name?: string;
          due_date?: string | null;
          due_time?: string | null;
          priority?: PlanTaskPriority;
          is_completed?: boolean;
          completed_at?: string | null;
          archived_at?: string | null;
        };
        Update: {
          title?: string;
          details?: string | null;
          list_name?: string;
          due_date?: string | null;
          due_time?: string | null;
          priority?: PlanTaskPriority;
          is_completed?: boolean;
          completed_at?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      plan_task_steps: {
        Row: {
          id: string;
          task_id: string;
          created_by: string;
          title: string;
          position: number;
          is_completed: boolean;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          created_by: string;
          title: string;
          position?: number;
          is_completed?: boolean;
          completed_at?: string | null;
        };
        Update: {
          title?: string;
          position?: number;
          is_completed?: boolean;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      plan_notes: {
        Row: {
          id: string;
          household_id: string | null;
          created_by: string;
          scope: CalendarEventScope;
          title: string | null;
          content: string | null;
          color: PlanNoteColor;
          pinned_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string | null;
          created_by: string;
          scope: CalendarEventScope;
          title?: string | null;
          content?: string | null;
          color?: PlanNoteColor;
          pinned_at?: string | null;
          archived_at?: string | null;
        };
        Update: {
          title?: string | null;
          content?: string | null;
          color?: PlanNoteColor;
          pinned_at?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      plan_reminders: {
        Row: {
          id: string;
          household_id: string | null;
          created_by: string;
          scope: CalendarEventScope;
          title: string;
          note: string | null;
          reminds_at: string;
          recurrence: PlanReminderRecurrence;
          is_completed: boolean;
          completed_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string | null;
          created_by: string;
          scope: CalendarEventScope;
          title: string;
          note?: string | null;
          reminds_at: string;
          recurrence?: PlanReminderRecurrence;
          is_completed?: boolean;
          completed_at?: string | null;
          archived_at?: string | null;
        };
        Update: {
          title?: string;
          note?: string | null;
          reminds_at?: string;
          recurrence?: PlanReminderRecurrence;
          is_completed?: boolean;
          completed_at?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
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
          pocket_type: WalletType;
          currency: string;
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
          pocket_type?: WalletType;
          currency?: string;
          icon?: string | null;
          sort_order?: number;
          is_archived?: boolean;
        };
        Update: {
          name?: string;
          pocket_type?: WalletType;
          currency?: string;
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
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          name: string;
          amount: string | number;
          currency: string;
          wallet_id: string | null;
          pocket_id: string | null;
          category_id: string;
          title: string | null;
          note: string | null;
          recurrence_type: "ONE_TIME" | "WEEKLY" | "MONTHLY" | "YEARLY";
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
          name: string;
          amount: string | number;
          currency: string;
          wallet_id?: string | null;
          pocket_id?: string | null;
          category_id: string;
          title?: string | null;
          note?: string | null;
          recurrence_type: "ONE_TIME" | "WEEKLY" | "MONTHLY" | "YEARLY";
          interval_count?: number;
          start_date: string;
          end_date?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          amount?: string | number;
          wallet_id?: string | null;
          pocket_id?: string | null;
          category_id?: string;
          title?: string | null;
          note?: string | null;
          recurrence_type?: "ONE_TIME" | "WEEKLY" | "MONTHLY" | "YEARLY";
          interval_count?: number;
          start_date?: string;
          end_date?: string | null;
          paused_at?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      bill_occurrences: {
        Row: {
          id: string;
          bill_id: string;
          due_date: string;
          expected_amount: string | number;
          status: "OPEN" | "PAID" | "SKIPPED";
          paid_transaction_id: string | null;
          paid_at: string | null;
          skipped_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      bill_tags: {
        Row: { bill_id: string; tag_id: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      installment_plans: {
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          name: string;
          total_amount: string | number;
          currency: string;
          installment_count: number;
          start_date: string;
          interval_months: number;
          wallet_id: string | null;
          pocket_id: string | null;
          category_id: string;
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
          name: string;
          total_amount: string | number;
          currency: string;
          installment_count: number;
          start_date: string;
          interval_months?: number;
          wallet_id?: string | null;
          pocket_id?: string | null;
          category_id: string;
          title?: string | null;
          note?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          wallet_id?: string | null;
          pocket_id?: string | null;
          category_id?: string;
          title?: string | null;
          note?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      installment_occurrences: {
        Row: {
          id: string;
          plan_id: string;
          sequence_number: number;
          due_date: string;
          expected_amount: string | number;
          status: "OPEN" | "PAID";
          paid_transaction_id: string | null;
          paid_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      saving_goals: {
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          name: string;
          target_amount: string | number;
          linked_pocket_id: string;
          target_date: string | null;
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
          name: string;
          target_amount: string | number;
          linked_pocket_id: string;
          target_date?: string | null;
          note?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          target_amount?: string | number;
          linked_pocket_id?: string;
          target_date?: string | null;
          note?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      debt_accounts: {
        Row: {
          id: string;
          scope: MoneyScope;
          owner_user_id: string | null;
          household_id: string | null;
          debt_type: "LIABILITY" | "RECEIVABLE";
          name: string;
          counterparty: string | null;
          currency: string;
          apr: string | number | null;
          due_date: string | null;
          note: string | null;
          archived_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          name?: string;
          counterparty?: string | null;
          apr?: string | number | null;
          due_date?: string | null;
          note?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      debt_events: {
        Row: {
          id: string;
          debt_account_id: string;
          event_kind:
            | "DRAW"
            | "PRINCIPAL_REPAYMENT"
            | "DISBURSEMENT"
            | "PRINCIPAL_RECEIPT";
          principal_amount: string | number;
          principal_transaction_id: string;
          interest_transaction_id: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      transaction_attachments: {
        Row: {
          id: string;
          transaction_id: string;
          storage_path: string;
          mime_type: string;
          file_name: string;
          file_size: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id: string;
          transaction_id: string;
          storage_path: string;
          mime_type: string;
          file_name: string;
          file_size: number;
          created_by: string;
        };
        Update: never;
        Relationships: [];
      };
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
        Args: {
          p_household_id: string;
          p_email: string;
          p_role?: HouseholdRole;
        };
        Returns: Database["public"]["Tables"]["household_members"]["Row"];
      };
      update_member_presentation: {
        Args: {
          p_household_id: string;
          p_display_name: string;
          p_member_color: string;
        };
        Returns: Database["public"]["Tables"]["household_members"]["Row"];
      };
      remove_household_member: {
        Args: { p_household_id: string; p_member_id: string };
        Returns: undefined;
      };
      change_household_member_role: {
        Args: {
          p_household_id: string;
          p_member_id: string;
          p_role: "admin" | "member" | "observer";
        };
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
          p_share_birthday_with_household: boolean;
          p_member_color: string;
          p_avatar_url: string | null;
        };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      create_shopping_item: {
        Args: {
          p_household_id: string;
          p_name: string;
          p_note: string | null;
          p_store: string | null;
          p_quantity: string;
          p_unit: string | null;
          p_estimated_amount: string | null;
          p_currency: string;
          p_assigned_member_id: string | null;
        };
        Returns: Database["public"]["Tables"]["shopping_items"]["Row"];
      };
      set_shopping_item_purchased: {
        Args: { p_item_id: string; p_purchased: boolean };
        Returns: Database["public"]["Tables"]["shopping_items"]["Row"];
      };
      set_shopping_item_archived: {
        Args: { p_item_id: string; p_archived: boolean };
        Returns: Database["public"]["Tables"]["shopping_items"]["Row"];
      };
      create_shopping_item_expense: {
        Args: {
          p_item_id: string;
          p_wallet_id: string;
          p_pocket_id: string;
          p_category_id: string;
          p_amount: string;
          p_title: string | null;
          p_note: string | null;
          p_occurred_at: string;
          p_tag_ids: string[] | null;
        };
        Returns: string;
      };
      create_inventory_item: {
        Args: {
          p_household_id: string;
          p_name: string;
          p_category: string;
          p_note: string | null;
          p_quantity: string;
          p_unit: string | null;
          p_restock_threshold: string | null;
          p_expiry_date: string | null;
          p_warranty_expires_on: string | null;
          p_purchase_date: string | null;
          p_location: string | null;
          p_estimated_restock_amount: string | null;
          p_currency: string;
        };
        Returns: Database["public"]["Tables"]["inventory_items"]["Row"];
      };
      set_inventory_quantity: {
        Args: { p_item_id: string; p_quantity: string };
        Returns: Database["public"]["Tables"]["inventory_items"]["Row"];
      };
      set_inventory_item_archived: {
        Args: { p_item_id: string; p_archived: boolean };
        Returns: Database["public"]["Tables"]["inventory_items"]["Row"];
      };
      send_inventory_item_to_shopping: {
        Args: { p_item_id: string };
        Returns: string;
      };
      get_calendar_export_birthdays: {
        Args: { p_household_id: string };
        Returns: Array<{
          subject_type: "MEMBER" | "PET";
          subject_id: string;
          display_name: string;
          month_day: string;
        }>;
      };
      materialize_chore_occurrences: {
        Args: { p_household_id: string; p_through_date?: string };
        Returns: number;
      };
      create_chore_template: {
        Args: {
          p_household_id: string;
          p_title: string;
          p_details: string;
          p_cadence: ChoreCadence;
          p_starts_on: string;
          p_due_time: string | null;
          p_member_ids: string[];
        };
        Returns: string;
      };
      claim_chore_occurrence: {
        Args: { p_occurrence_id: string };
        Returns: undefined;
      };
      complete_chore_occurrence: {
        Args: { p_occurrence_id: string };
        Returns: undefined;
      };
      set_chore_template_active: {
        Args: { p_template_id: string; p_active: boolean };
        Returns: undefined;
      };
      create_pet: {
        Args: {
          p_id: string;
          p_household_id: string;
          p_name: string;
          p_species: PetSpecies;
          p_breed: string | null;
          p_sex: PetSex | null;
          p_birthday: string | null;
          p_photo_path: string | null;
          p_caregiver_member_ids: string[];
        };
        Returns: Database["public"]["Tables"]["pets"]["Row"];
      };
      update_pet: {
        Args: {
          p_pet_id: string;
          p_name: string;
          p_species: PetSpecies;
          p_breed: string | null;
          p_sex: PetSex | null;
          p_birthday: string | null;
          p_photo_path: string | null;
          p_caregiver_member_ids: string[];
        };
        Returns: Database["public"]["Tables"]["pets"]["Row"];
      };
      set_pet_archived: {
        Args: { p_pet_id: string; p_archived: boolean };
        Returns: Database["public"]["Tables"]["pets"]["Row"];
      };
      create_calendar_event: {
        Args: {
          p_id: string;
          p_scope: CalendarEventScope;
          p_household_id: string | null;
          p_title: string;
          p_note: string | null;
          p_is_all_day: boolean;
          p_all_day_date: string | null;
          p_starts_at: string | null;
          p_ends_at: string | null;
          p_member_ids: string[];
        };
        Returns: Database["public"]["Tables"]["calendar_events"]["Row"];
      };
      update_calendar_event: {
        Args: {
          p_event_id: string;
          p_title: string;
          p_note: string | null;
          p_is_all_day: boolean;
          p_all_day_date: string | null;
          p_starts_at: string | null;
          p_ends_at: string | null;
          p_member_ids: string[];
        };
        Returns: Database["public"]["Tables"]["calendar_events"]["Row"];
      };
      set_calendar_event_archived: {
        Args: { p_event_id: string; p_archived: boolean };
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
      create_wallet_with_initial_balance: {
        Args: {
          p_scope: MoneyScope;
          p_owner_user_id: string | null;
          p_household_id: string | null;
          p_name: string;
          p_wallet_type: WalletType;
          p_currency: string;
          p_first_pocket_name: string;
          p_initial_balance?: string;
        };
        Returns: string;
      };
      create_wallet_container_with_first_pocket: {
        Args: {
          p_scope: MoneyScope;
          p_owner_user_id: string | null;
          p_household_id: string | null;
          p_name: string;
          p_first_pocket_name: string;
          p_first_pocket_type: WalletType;
          p_currency: string;
          p_initial_balance?: string;
          p_credit_limit?: string | null;
          p_available_credit?: string | null;
          p_statement_closing_day?: number | null;
          p_payment_due_day?: number | null;
        };
        Returns: string;
      };
      create_pocket_with_initial_balance: {
        Args: {
          p_wallet_id: string;
          p_name: string;
          p_pocket_type: WalletType;
          p_currency: string;
          p_initial_balance?: string;
        };
        Returns: string;
      };
      update_pocket_details: {
        Args: {
          p_pocket_id: string;
          p_wallet_id: string;
          p_name: string;
          p_pocket_type: WalletType;
          p_target_balance: string;
        };
        Returns: undefined;
      };
      create_credit_card_pocket_with_available_credit: {
        Args: {
          p_wallet_id: string;
          p_name: string;
          p_currency: string;
          p_credit_limit: string;
          p_available_credit: string;
          p_statement_closing_day: number;
          p_payment_due_day: number;
        };
        Returns: string;
      };
      create_credit_card_account_with_available_credit: {
        Args: {
          p_scope: MoneyScope;
          p_household_id: string | null;
          p_name: string;
          p_currency: string;
          p_credit_limit: string;
          p_available_credit: string;
          p_statement_closing_day: number;
          p_payment_due_day: number;
        };
        Returns: string;
      };
      get_credit_card_accounts: {
        Args: { p_include_archived?: boolean };
        Returns: Array<{
          account_id: string;
          wallet_id: string;
          system_pocket_id: string;
          name: string;
          issuer: string | null;
          network: string | null;
          last_four: string | null;
          scope: MoneyScope;
          household_id: string | null;
          currency: string;
          credit_limit: string | number;
          wallet_balance: string | number;
          liability: string | number;
          card_credit: string | number;
          available_credit: string | number;
          statement_closing_day: number;
          payment_due_day: number;
          apr: string | number | null;
          is_archived: boolean;
        }>;
      };
      create_credit_card_payment: {
        Args: {
          p_card_account_id: string;
          p_from_wallet_id: string;
          p_from_pocket_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string;
        };
        Returns: string;
      };
      create_credit_card_cashback: {
        Args: {
          p_card_account_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string;
        };
        Returns: string;
      };
      create_credit_card_cash_advance: {
        Args: {
          p_card_account_id: string;
          p_to_wallet_id: string;
          p_to_pocket_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string;
        };
        Returns: string;
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
        Args: {
          p_period_month: string;
          p_month_start: string;
          p_month_end: string;
        };
        Returns: unknown;
      };
      set_template_tags: {
        Args: { p_template_id: string; p_tag_ids: string[] | null };
        Returns: string;
      };
      recurring_next_due_date: {
        Args: {
          p_prev: string;
          p_start: string;
          p_frequency: string;
          p_interval_count: number;
          p_anchor_day: number | null;
        };
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
      materialize_bill_occurrences: {
        Args: { p_scope: MoneyScope; p_household_id?: string | null };
        Returns: undefined;
      };
      set_bill_tags: {
        Args: { p_bill_id: string; p_tag_ids: string[] | null };
        Returns: string;
      };
      skip_bill_occurrence: {
        Args: { p_occurrence_id: string };
        Returns: string;
      };
      pay_bill_occurrence: {
        Args: {
          p_occurrence_id: string;
          p_wallet_id: string;
          p_pocket_id: string;
          p_category_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string | null;
          p_tag_ids?: string[] | null;
        };
        Returns: string;
      };
      pay_installment_occurrence: {
        Args: {
          p_occurrence_id: string;
          p_wallet_id: string;
          p_pocket_id: string;
          p_category_id: string;
          p_amount: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string | null;
          p_tag_ids?: string[] | null;
        };
        Returns: string;
      };
      get_saving_goal_progress: {
        Args: { p_scope: MoneyScope; p_household_id?: string | null };
        Returns: unknown;
      };
      create_debt_account: {
        Args: {
          p_scope: MoneyScope;
          p_household_id: string | null;
          p_debt_type: "LIABILITY" | "RECEIVABLE";
          p_name: string;
          p_counterparty: string | null;
          p_currency: string;
          p_opening_principal: string;
          p_wallet_id: string;
          p_pocket_id: string;
          p_apr?: string | null;
          p_due_date?: string | null;
          p_note?: string | null;
          p_occurred_at?: string | null;
        };
        Returns: string;
      };
      record_debt_payment: {
        Args: {
          p_debt_id: string;
          p_wallet_id: string;
          p_pocket_id: string;
          p_principal: string;
          p_interest: string;
          p_interest_category_id: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string | null;
          p_tag_ids?: string[] | null;
        };
        Returns: string;
      };
      record_additional_debt_principal: {
        Args: {
          p_debt_id: string;
          p_wallet_id: string;
          p_pocket_id: string;
          p_principal: string;
          p_title?: string | null;
          p_note?: string | null;
          p_occurred_at?: string | null;
        };
        Returns: string;
      };
      debt_outstanding: {
        Args: { p_debt_id: string };
        Returns: string | number;
      };
      get_debt_summary: {
        Args: { p_scope: MoneyScope; p_household_id?: string | null };
        Returns: unknown;
      };
      get_finance_reports: {
        Args: {
          p_scope: MoneyScope;
          p_household_id: string | null;
          p_start: string;
          p_end: string;
        };
        Returns: unknown;
      };
      get_calendar_finance_items: {
        Args: { p_start: string; p_end: string };
        Returns: unknown;
      };
      import_finance_transactions: {
        Args: { p_rows: unknown };
        Returns: number;
      };
      get_finance_export: {
        Args: {
          p_from: string | null;
          p_to: string | null;
          p_wallet_id: string | null;
          p_pocket_id: string | null;
          p_category_id: string | null;
          p_type: TransactionType | null;
          p_tag_id: string | null;
        };
        Returns: unknown;
      };
      get_net_worth: { Args: Record<string, never>; Returns: unknown };
      get_finance_insights: {
        Args: {
          p_current_start: string;
          p_current_end: string;
          p_previous_start: string;
          p_today: string;
        };
        Returns: unknown;
      };
      get_finance_hub_final: {
        Args: { p_report_start: string; p_report_end: string; p_today: string };
        Returns: unknown;
      };
      get_push_public_config: {
        Args: Record<string, never>;
        Returns: Array<{ vapid_public_key: string; vapid_subject: string }>;
      };
      get_push_server_secrets: {
        Args: Record<string, never>;
        Returns: Array<{ vapid_private_key: string; cron_secret: string }>;
      };
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
