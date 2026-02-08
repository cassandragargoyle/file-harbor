# Custom Categories

## Summary

Currently, document categories are hardcoded (`Identity`, `Taxes`, `Banking`, etc.). Allowing users to create their own categories would make the app useful for more people — a freelancer might want `Clients` and `Invoices`, a student might want `Coursework`.

## Is it a good idea?

**Yes, strongly.** The current list is opinionated. Different users organize differently, and custom categories let the app adapt to each user's needs.

## How hard is it to implement?

**Moderate — not trivial, but very doable.**

### What's working in our favor

- The database already stores `category` as a plain `text` column (not an enum), so **no schema migration needed** for the documents table
- Categories are centralized in `src/shared/constants.ts` and `src/shared/types.ts`
- The category-to-icon mapping in `CategoryPicker.tsx` and `Sidebar.tsx` is the main coupling point

### What would need to change

1. **New `categories` table** — store user-defined categories (name, icon, color, sort order) per workspace
2. **Replace the `Category` union type** — change from a string literal union to just `string`, or a validated type backed by the DB
3. **Replace `CATEGORIES` constant** — load categories from DB instead of importing a hardcoded array
4. **Update `DocumentCounts`** — currently typed as a record keyed by the union type; needs to become dynamic
5. **Update `CategoryPicker`** — allow icon selection instead of hardcoded `CATEGORY_ICONS` map
6. **Update `Sidebar`** — render dynamic categories with their chosen icons
7. **Add CRUD UI** — a small settings panel or inline editing for managing categories (add/rename/reorder/delete)
8. **Handle deletion** — what happens to documents in a deleted category? (move to Inbox is the obvious answer)

### Trickiest parts

- Icon selection UX — letting users pick from a set of icons
- The `ViewType` in the store is currently `'inbox' | Category` (a union type) — this needs to become string-based
- Making sure counts, navigation, and filtering all work with dynamic data

### Touchpoints

~8-10 files would need changes. The core data flow (DB → IPC → renderer) is already clean, so it's mostly widening types from a fixed union to dynamic strings and loading from DB instead of constants.
