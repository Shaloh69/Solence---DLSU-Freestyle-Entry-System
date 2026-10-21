# engine/pdf/

Permit-ready PDF export (brief Phase 7): pdfkit generator producing the
wiring diagram (+ circuit legend), panel schedule, conductor schedule,
and panel directory; every page carries the PEC-VERIFY disclaimer.
Known gaps (item W9, docs/WIRING-AUDIT.md F-16): built-in Helvetica
can't print `²`/`⚠` (embed fonts), A4 instead of A3 sheets, no title
block, PH symbol legend (E-1), general notes or one-line diagram (only
the circuit legend exists). Extend by adding a draw*Page function and calling it from
`generatePermitPdf` — keep content inside the printable area or pdfkit
silently adds pages.
