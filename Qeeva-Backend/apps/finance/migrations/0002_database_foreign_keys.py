"""Foreign keys whose delete rules (and "same owner" rule) must live in the database itself.

Why raw SQL: Django 5.2 cannot express ``ON DELETE`` in the database, and it cannot express a
foreign key over two columns that is not the primary key. We need both.

**Same-owner rule.** Every child row points at its parent with ``(parent_id, user_id)``, which
must exist in the parent as ``(id, user_id)`` (a unique constraint made in 0001). So a card can
never be attached to another user's month or item, even if our code had a bug.

**Delete rules**
* ``profiles`` -> every table's ``user_id``: delete the rows (deleting a Supabase user wipes the
  user's finance data; the profile itself disappears through ``auth.users``, see accounts 0002).
* ``months`` -> ``month_incomes`` and ``month_items``: delete the children.
* ``items`` -> ``item_merge_dismissals``: delete the dismissals.
* ``items`` -> ``month_items``: **no action**, i.e. an item that still has cards cannot be deleted.
  "No action" is checked at the end of the statement, so deleting a whole user (which also deletes
  their cards in the same statement) still works.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_database_foreign_keys"),
        ("finance", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                -- user_id -> profiles: the owner of every row is a real profile.
                ALTER TABLE "months" ADD CONSTRAINT "months_user_id_profiles_fk"
                    FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE;
                ALTER TABLE "items" ADD CONSTRAINT "items_user_id_profiles_fk"
                    FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE;
                ALTER TABLE "month_incomes" ADD CONSTRAINT "month_incomes_user_id_profiles_fk"
                    FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE;
                ALTER TABLE "month_items" ADD CONSTRAINT "month_items_user_id_profiles_fk"
                    FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE;
                ALTER TABLE "item_merge_dismissals"
                    ADD CONSTRAINT "item_merge_dismissals_user_id_profiles_fk"
                    FOREIGN KEY ("user_id") REFERENCES "profiles" ("id") ON DELETE CASCADE;

                -- income line -> its month, with the same owner.
                ALTER TABLE "month_incomes" ADD CONSTRAINT "month_incomes_month_owner_fk"
                    FOREIGN KEY ("month_id", "user_id") REFERENCES "months" ("id", "user_id")
                    ON DELETE CASCADE;

                -- card -> its month (cascade) and its item (no action), with the same owner.
                ALTER TABLE "month_items" ADD CONSTRAINT "month_items_month_owner_fk"
                    FOREIGN KEY ("month_id", "user_id") REFERENCES "months" ("id", "user_id")
                    ON DELETE CASCADE;
                ALTER TABLE "month_items" ADD CONSTRAINT "month_items_item_owner_fk"
                    FOREIGN KEY ("item_id", "user_id") REFERENCES "items" ("id", "user_id")
                    ON DELETE NO ACTION;

                -- merge dismissal -> both items (cascade), with the same owner.
                ALTER TABLE "item_merge_dismissals"
                    ADD CONSTRAINT "item_merge_dismissals_item_a_owner_fk"
                    FOREIGN KEY ("item_a_id", "user_id") REFERENCES "items" ("id", "user_id")
                    ON DELETE CASCADE;
                ALTER TABLE "item_merge_dismissals"
                    ADD CONSTRAINT "item_merge_dismissals_item_b_owner_fk"
                    FOREIGN KEY ("item_b_id", "user_id") REFERENCES "items" ("id", "user_id")
                    ON DELETE CASCADE;
            """,
            reverse_sql="""
                ALTER TABLE "item_merge_dismissals"
                    DROP CONSTRAINT "item_merge_dismissals_item_b_owner_fk";
                ALTER TABLE "item_merge_dismissals"
                    DROP CONSTRAINT "item_merge_dismissals_item_a_owner_fk";
                ALTER TABLE "month_items" DROP CONSTRAINT "month_items_item_owner_fk";
                ALTER TABLE "month_items" DROP CONSTRAINT "month_items_month_owner_fk";
                ALTER TABLE "month_incomes" DROP CONSTRAINT "month_incomes_month_owner_fk";
                ALTER TABLE "item_merge_dismissals"
                    DROP CONSTRAINT "item_merge_dismissals_user_id_profiles_fk";
                ALTER TABLE "month_items" DROP CONSTRAINT "month_items_user_id_profiles_fk";
                ALTER TABLE "month_incomes" DROP CONSTRAINT "month_incomes_user_id_profiles_fk";
                ALTER TABLE "items" DROP CONSTRAINT "items_user_id_profiles_fk";
                ALTER TABLE "months" DROP CONSTRAINT "months_user_id_profiles_fk";
            """,
        )
    ]
