# Mobile density correction — 22 September 2026

The previous responsive pass still used oversized cards and headings relative to the user's compact phone references. It also compounded the reader's outside gutter with nested padding, left loading views at a full viewport below the header, and omitted a consistent staff layout.

This change applies at widths of 700 CSS pixels and below. It preserves native device viewport scaling, browser zoom, the existing desktop composition, 44px primary actions and 16px workbook editing text.

| Surface | Change |
| --- | --- |
| Shared learner header | 44px header, 28px mark, compact brand and location text |
| Learning library | Two columns, 138px minimum cards, compact title and volume navigation |
| Profile | 32px page title, 22px card headings, 30px icons, tighter rows and gaps |
| Today | Single 16px outside gutter, 16px hero padding, smaller heading and progress panel |
| Handbook reader | Removes doubled page padding; 14px reading text, 30px day heading, compact map and save status |
| Learner loading | Available viewport height accounts for the header; 27px heading |
| Staff workspace | Compact two-column header actions, three stacked navigation rows, compact cohort and metric cards |
| Staff loading | Uses remaining flex space; removes the extra 70vh minimum below the header and navigation |
| Staff navigation | Workspace and cohort navigation scroll normally instead of covering content |

## Verification and limits

- ESLint passed.
- All 186 existing acceptance tests passed, including workbook save failure and concurrent edit cases.
- Production build and deployment results are recorded with the release commit.
- The corrected CSS uses component-scoped selectors to take precedence over styles imported by nested routes.
- Live rendered mobile and desktop comparison remains **unverified**. The cloud browser rejects the local development preview (`ERR_BLOCKED_BY_CLIENT`). Vercel preview authentication was unavailable in the preceding attempt. No access protection was disabled.
- Source values and passing build checks establish that the correction is delivered; they do not establish pixel-level agreement with the reference screenshots.
- Physical screenshot pixels are not assumed to equal CSS viewport pixels. No global zoom, fixed desktop viewport, or transform-based shrinking is introduced.
- Volume 1 and 2 Lab manuscripts, Lab scoring, auth configuration and workbook persistence are outside this CSS correction.
