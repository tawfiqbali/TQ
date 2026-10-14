// Styles for the printed progress report. Used both in the preview (inside
// the admin panel) and in the print window, so they live in one string.
// Each .d-page is one A4 sheet (794 × 1123 px on screen = 210 × 297 mm).
export const DOSSIER_CSS = `
.qit-dossier{--ink:#0B2E31;--teal:#004D51;--teal-2:#0F766E;--mint:#E8F4F4;--line:#CFE3E5;--muted:#5B7477;--gold:#C89A3C;--gold-soft:#FBF4E6;
  color:var(--ink);font-family:'Barlow','Hind Siliguri',Bahnschrift,system-ui,sans-serif;font-size:13.5px;line-height:1.5}
.qit-dossier.bn{font-family:'Hind Siliguri','Barlow',Bahnschrift,system-ui,sans-serif;font-size:14px;line-height:1.6}
.qit-dossier *{box-sizing:border-box;margin:0;padding:0}
.qit-dossier .d-page{position:relative;width:794px;min-height:1123px;margin:0 auto;background:#fff;padding:44px 50px 30px;display:flex;flex-direction:column;justify-content:space-between;
  box-shadow:0 1px 3px rgba(0,0,0,.08),0 12px 32px -12px rgba(0,35,38,.25);border-radius:4px;overflow:hidden}
.qit-dossier .d-page::before{content:'';position:absolute;inset:0 0 auto 0;height:6px;background:linear-gradient(90deg,var(--teal),var(--teal-2) 70%,var(--gold))}

/* Letterhead */
.qit-dossier .d-head{display:flex;justify-content:space-between;align-items:center;gap:20px;padding-bottom:16px;border-bottom:1.5px solid var(--ink);margin-bottom:6px;position:relative}
.qit-dossier .d-head::after{content:'';position:absolute;left:0;right:0;bottom:-5px;height:1px;background:var(--gold)}
.qit-dossier .d-brand{display:flex;align-items:center;gap:14px}
.qit-dossier .d-logo{width:54px;height:54px;object-fit:contain}
.qit-dossier .d-org{font-size:21px;font-weight:800;letter-spacing:.01em;color:var(--ink);line-height:1.15}
.qit-dossier .d-org-sub{font-size:11.5px;font-weight:600;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;margin-top:3px}
.qit-dossier.bn .d-org-sub{text-transform:none;letter-spacing:0;font-size:12.5px}
.qit-dossier .d-doc{text-align:right}
.qit-dossier .d-doc-title{font-size:19px;font-weight:800;color:var(--teal)}
.qit-dossier .d-doc-period{display:inline-block;margin-top:4px;padding:3px 12px;border-radius:999px;background:var(--gold-soft);border:1px solid #E8D3A6;color:#8A6424;font-weight:700;font-size:12px}

/* Report details strip */
.qit-dossier .d-meta{display:grid;grid-template-columns:1.3fr 1fr 1fr .9fr;margin:20px 0 6px;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.qit-dossier .d-meta.no-ref{grid-template-columns:1fr 1fr 1fr}
.qit-dossier .d-meta>div{padding:9px 12px;border-right:1px solid var(--line);background:#FAFCFC}
.qit-dossier .d-meta>div:last-child{border-right:none}
.qit-dossier .d-meta span{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.qit-dossier.bn .d-meta span{text-transform:none;letter-spacing:0;font-size:11px}
.qit-dossier .d-meta strong{display:block;font-size:12.5px;font-weight:700;margin-top:2px;word-break:break-word}

/* Section headings */
.qit-dossier .d-section{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--teal);margin:24px 0 10px}
.qit-dossier.bn .d-section{letter-spacing:0;text-transform:none;font-size:14px}
.qit-dossier .d-section::before{content:'';width:4px;height:15px;border-radius:2px;background:var(--gold)}
.qit-dossier .d-section::after{content:'';flex:1;height:1px;background:var(--line)}

/* Student & class tables */
.qit-dossier .d-info{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.qit-dossier table{width:100%;border-collapse:collapse}
.qit-dossier .d-info table{border:1px solid var(--line);border-radius:8px;overflow:hidden;border-collapse:separate;border-spacing:0}
.qit-dossier .d-info th,.qit-dossier .d-info td{padding:8px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
.qit-dossier .d-info tr:last-child th,.qit-dossier .d-info tr:last-child td{border-bottom:none}
.qit-dossier .d-info th{width:40%;background:var(--mint);font-size:11.5px;font-weight:700;color:var(--muted)}
.qit-dossier .d-info td{font-weight:600}
.qit-dossier .strong{font-weight:800!important;color:var(--ink)}

/* Letter */
.qit-dossier .d-letter{margin:22px 0 4px;padding:18px 22px;background:linear-gradient(180deg,#F7FBFB,#F1F8F8);border:1px solid var(--line);border-left:4px solid var(--teal);border-radius:0 8px 8px 0;white-space:pre-line;font-size:13.5px;line-height:1.75;color:#1C3B3E}
.qit-dossier.bn .d-letter{font-size:14.5px;line-height:1.85}

/* Attendance */
.qit-dossier .d-att{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.qit-dossier .d-kpi{border:1px solid var(--line);border-radius:10px;padding:14px 12px;text-align:center;background:#FAFCFC}
.qit-dossier .d-kpi span{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.qit-dossier.bn .d-kpi span{text-transform:none;letter-spacing:0;font-size:12px}
.qit-dossier .d-kpi strong{display:block;font-size:26px;font-weight:800;margin-top:4px;color:var(--ink);line-height:1.2}
.qit-dossier .d-kpi.ok{background:#F0FDF4;border-color:#BBF7D0}.qit-dossier .d-kpi.ok strong{color:#15803D}
.qit-dossier .d-kpi.bad{background:#FEF2F2;border-color:#FECACA}.qit-dossier .d-kpi.bad strong{color:#B91C1C}
.qit-dossier .d-kpi.rate{background:var(--teal);border-color:var(--teal)}.qit-dossier .d-kpi.rate span{color:#BFE3E1}.qit-dossier .d-kpi.rate strong{color:#fff}
.qit-dossier .d-bar{height:10px;border-radius:999px;background:#E3EEEF;margin-top:14px;overflow:hidden}
.qit-dossier .d-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--teal-2),#34D399)}
.qit-dossier .d-bar-note{margin-top:6px;font-size:11.5px;font-weight:700;color:var(--teal-2);text-align:right}

/* Evaluation */
.qit-dossier .d-eval{display:grid;grid-template-columns:1fr 170px;gap:16px;align-items:stretch}
.qit-dossier .d-eval table{border:1px solid var(--line);border-radius:8px;overflow:hidden;border-collapse:separate;border-spacing:0}
.qit-dossier .d-eval th{background:var(--teal);color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:9px 12px;text-align:left}
.qit-dossier.bn .d-eval th{text-transform:none;letter-spacing:0;font-size:12.5px}
.qit-dossier .d-eval td{padding:11px 12px;border-bottom:1px solid var(--line);font-weight:600;vertical-align:middle}
.qit-dossier .d-eval tr:nth-child(even) td{background:#FAFCFC}
.qit-dossier .d-eval tr:last-child td{border-bottom:none}
.qit-dossier .w-bar{width:28%}
.qit-dossier .d-mini{height:8px;border-radius:999px;background:#E3EEEF;overflow:hidden}
.qit-dossier .d-mini i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--teal),var(--teal-2))}
.qit-dossier .d-grade{border-radius:10px;background:linear-gradient(160deg,var(--teal),#00373D);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px 12px;border:2px solid var(--gold)}
.qit-dossier .d-grade span{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#F2DDB0}
.qit-dossier.bn .d-grade span{text-transform:none;letter-spacing:0;font-size:12.5px}
.qit-dossier .d-grade strong{font-size:17px;font-weight:800;margin-top:8px;line-height:1.3}

/* Achievements, goals, remarks */
.qit-dossier .d-two{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}
.qit-dossier .d-note{border:1px solid var(--line);border-top:3px solid;border-radius:8px;padding:14px 16px;background:#fff}
.qit-dossier .d-note.good{border-top-color:#16A34A}.qit-dossier .d-note.next{border-top-color:var(--gold)}
.qit-dossier .d-note span,.qit-dossier .d-remarks span{display:block;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}
.qit-dossier.bn .d-note span,.qit-dossier.bn .d-remarks span{text-transform:none;letter-spacing:0;font-size:12.5px}
.qit-dossier .d-note p{margin-top:6px;font-weight:600;line-height:1.6;white-space:pre-line}
.qit-dossier .d-remarks{margin-top:14px;padding:16px 18px;border-radius:8px;background:var(--gold-soft);border:1px solid #EAD7AE;border-left:4px solid var(--gold)}
.qit-dossier .d-remarks p{margin-top:6px;font-size:13.5px;font-weight:500;line-height:1.7;white-space:pre-line;color:#3A3222}

/* Grading key */
.qit-dossier .d-key{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.qit-dossier .d-key>div{border:1px solid var(--line);border-radius:8px;padding:9px 8px;text-align:center;background:#FAFCFC}
.qit-dossier .d-key strong{display:block;font-size:12.5px;font-weight:800;color:var(--teal)}
.qit-dossier .d-key span{display:block;font-size:11px;font-weight:600;color:var(--muted);margin-top:2px;line-height:1.3}
.qit-dossier .d-key>div.on{background:var(--teal);border-color:var(--teal)}
.qit-dossier .d-key>div.on strong{color:#F2DDB0}.qit-dossier .d-key>div.on span{color:#fff}

/* Signatures */
.qit-dossier .d-sign{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:24px;margin:26px 0 18px}
.qit-dossier .d-sig{display:flex;flex-direction:column;align-items:center;text-align:center}
.qit-dossier .d-sig-space{height:56px}
.qit-dossier .d-sig-img{height:56px;width:auto;object-fit:contain}
.qit-dossier .d-sig-line{width:190px;height:1px;background:var(--ink);margin:6px 0}
.qit-dossier .d-sig strong{font-size:13px;font-weight:800}
.qit-dossier .d-sig span{font-size:11px;font-weight:600;color:var(--muted)}
.qit-dossier .d-seal{width:92px;height:92px;border-radius:50%;border:2px solid var(--gold);outline:4px double rgba(200,154,60,.45);outline-offset:3px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--teal);text-align:center}
.qit-dossier .d-seal div{font-size:22px;font-weight:800;letter-spacing:.06em;line-height:1}
.qit-dossier .d-seal span{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-top:4px;color:#8A6424}

/* Footer */
.qit-dossier .d-foot{display:flex;justify-content:space-between;gap:16px;padding-top:10px;border-top:1px solid var(--line);font-size:10.5px;font-weight:600;color:var(--muted)}
.qit-dossier .page-break{border:none;height:28px}
`;

// Extra rules applied only in the print window: two exact A4 pages
export const DOSSIER_PRINT_CSS = `
@page{size:A4 portrait;margin:0}
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
html,body{margin:0;background:#fff}
.qit-dossier .d-page{width:210mm!important;height:297mm!important;min-height:0!important;padding:13mm 14mm 9mm!important;box-shadow:none!important;border-radius:0!important;page-break-after:always;break-after:page}
.qit-dossier .d-page:last-child{page-break-after:auto;break-after:auto}
.qit-dossier .page-break{display:none!important}
`;
