# engine/pdf/

Permit-ready PDF export (brief Phase 7): pdfkit generator producing the
wiring diagram (+ circuit legend), panel schedule, conductor schedule,
and panel directory; every page carries the PEC-VERIFY disclaimer.
Extend by adding a draw*Page function and calling it from
`generatePermitPdf` — keep content inside the printable area or pdfkit
silently adds pages.
