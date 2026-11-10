# Execution and approval security

AI proposes. Code decides. `lib/bear/engine/execution.ts` is the only path to an outward action.

1. **Approval binds to the exact action.** The key is a hash of the responsibility, action type and canonical details (recipient, amount, document, destination). Change any detail and the key changes: the old approval does not apply and a fresh one is needed.
2. **Approvals expire** (7 days), can be declined, and can be revoked. Expired, declined or revoked means no action.
3. **The log is a hard dependency.** If the approval or the attempt can't be recorded, the action is not run (`cannot_record`). This includes the migration not being applied.
4. **Idempotency.** The key is passed to the provider. The same approved action is never repeated. After a timeout or crash, Bear asks the provider (`check`); if it can't tell, it stops (`unknown_outcome`) and asks the person. Only a failure the provider says happened before sending (`retrySafe`) can be retried, up to 3 attempts.
5. **Accepted is not confirmed.** Provider acceptance leaves the responsibility `awaiting_confirmation`. Confirmation needs provider verification or real evidence (forwarded email, document, the person).
6. **Safe internal actions** (draft, plan, reminder, organise) never leave Bear and need no approval.
7. **Prompt injection.** Source text is data. It cannot grant approval, change a recipient or trigger an action.
8. **Logs hold keys and kinds only.** No recipients, amounts, subjects or message text.

## Capability status
| Action | Status |
|---|---|
| draft message, plan, set reminder, organise | Implemented and connected |
| prepare calendar file | Implemented and connected: **Add to calendar** on the task page downloads a file the person opens; Bear adds nothing. See `docs/CALENDAR_INTEGRATION.md` |
| send message, share information | Unsupported (no mail integration) |
| create calendar event (all-day, in the person's Outlook calendar) | Implemented, awaiting configuration (`BEAR_CALENDAR_ENABLED` and Microsoft app settings); verified only against a local stand-in so far. See `docs/CALENDAR_INTEGRATION.md` |
| submit form, book appointment, contact provider | Unsupported |
| make payment, make purchase | Unsupported; Bear shows amount, reference and link for the person |

Uploaded PDFs (forms) are untrusted: only field names and types are read, nothing is executed, text inside the file is never treated as instructions, and files are limited to 10 MB and stored under the owner's id. See `docs/FORM_WORKFLOW.md`.

Nothing simulates success. Until configured, every outward action reports `not_available` with the manual handoff. Tests use an injected test adapter; production never passes one.

Enabling real actions needs the owner's explicit authorisation, a real integration per action, and a review of this document.
