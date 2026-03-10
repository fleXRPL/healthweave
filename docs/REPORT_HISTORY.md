# Report History UI

## What is this?

Every time you upload documents and run an analysis, HealthWeave saves the report to a database. The Report History feature lets you go back and view or download any of those past reports without having to re-upload your documents and re-run the analysis.

---

## How to use it

### Viewing past reports

1. On the main upload page, click the **Past Reports** button in the top-right corner of the header.
2. You'll see a list of all your previous analyses, sorted by date. Each card shows:
   - The date the analysis was run
   - How many documents were analyzed and their file names
   - A preview of the AI summary
   - How many findings and recommendations were in the report
   - Which AI model generated it
3. Click **View** on any report to open the full analysis — same view as when you first ran it.
4. Click **PDF** to download that report as a PDF directly from the history list.

### Getting back

- From the history list, click **New Analysis** to go back to the upload form.
- From a report opened via history, you have two buttons at the top: **Analyze New Documents** (goes to upload form) and **Past Reports** (goes back to the history list).

---

## What was built

### New component: `ReportHistory.tsx`

This is the history list screen. When it loads, it calls the backend to fetch all reports for the current user (`GET /api/reports`), then displays them as cards. Key behaviours:

- Shows a loading spinner while fetching
- Shows a friendly empty state if there are no reports yet
- Handles download directly from the list (same PDF download logic as the results screen)
- Maps the stored report format into the format the results viewer expects, so opening a historical report looks identical to viewing a fresh one

### Updated: `page.tsx`

The main page now has three possible views instead of two:

| View | What it shows |
|------|--------------|
| `upload` | The document upload form (default) |
| `results` | The analysis results for the most recent or selected report |
| `history` | The past reports list |

A **Past Reports** button was added to the header (always visible) and also appears on the results view so you can navigate between them without losing context.

### Updated: `AnalysisResults.tsx`

Minor fixes applied alongside the new feature:
- `window.URL` replaced with `globalThis.URL` (better cross-environment compatibility)
- `parentNode.removeChild()` replaced with `element.remove()` (modern DOM API)
- React list keys changed from array index to content-based keys (prevents subtle rendering bugs when list contents change)
- Props marked as `readonly` (TypeScript best practice)

---

## How the data flows

```
User clicks "Past Reports"
        ↓
ReportHistory component loads
        ↓
GET /api/reports?userId=test-user  →  backend queries DynamoDB
        ↓
List of AnalysisResult objects returned
        ↓
Displayed as cards in the UI

User clicks "View" on a card
        ↓
Report mapped to display format
        ↓
page.tsx switches to "results" view
        ↓
AnalysisResults component renders it (same as a fresh analysis)
```

---

## Notes

- There is no authentication yet — all reports are stored and retrieved under `test-user`. Once auth is added (issue #4), each user will only see their own reports.
- The backend endpoint (`GET /api/reports`) already existed before this feature — this was purely a frontend change to expose that data in the UI.
- Reports are stored indefinitely in DynamoDB. There is no delete or archive feature yet.
