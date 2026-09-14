# Member Management V1

Member color belongs to `household_members`, because one profile can belong
to several households and may use a different presentation color in each.
Colors use a six-value database-constrained palette.

| Capability | Owner | Admin | Member |
|---|---:|---:|---:|
| View household members | Yes | Yes | Yes |
| Edit own display name/color | Yes | Yes | Yes |
| Invite member | Yes | Yes | No |
| Invite admin | Yes | No | No |
| Change admin/member roles | Yes | No | No |
| Assign or change owner | No | No | No |

Role changes use `change_household_member_role`. Presentation changes use
`update_member_presentation`. Both are `SECURITY DEFINER` RPCs that derive
the actor from `auth.uid()` and validate authorization internally. Direct
membership writes remain revoked.

Removal and leaving are deferred. Current membership has no archive/status
model, and V1 should not introduce hard deletion before its effects on
household access and operational recovery are designed. Profiles and
historical finance references are never deleted by Member Management V1.
