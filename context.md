MEST AI Cohort & Performance Intelligence System Google Stitch UI Design Brief Version 1.0 · 2025 · Confidential

SECTION 1 — PROJECT OVERVIEW What Is This System? MEST Africa runs a flagship entrepreneurship program where young Africans come to learn how to build startups — spanning communication, technology, and business. Throughout the program, trainees work in classes, build products in teams, pitch to experts, and ultimately form their final company (called Newco) to seek investment from MEST. The challenge is that tracking individual growth, team dynamics, pivots, and performance across this entire journey has historically been manual, fragmented, and vulnerable to bias. Strong performers who are quieter can be overlooked. Team breakdowns go undocumented. Funding decisions can be driven by sentiment rather than evidence. This system — the MEST AI Cohort & Performance Intelligence System — solves that. It is a centralized web platform for program facilitators and MEST leadership to track everything: individual trainees, team formations, events, feedback, and performance — over the full duration of a cohort. Core Design Philosophy Three parallel layers of tracking must coexist and inform each other at all times:

INDIVIDUAL LAYER — Every trainee has a persistent profile. Their scores, contributions, roles, flags, and growth are tracked across every team they join and every event they participate in. The system must surface quiet but strong performers automatically.

TEAM LAYER — Teams are temporary and event-scoped. They form, evolve, pivot, sometimes break down. Every change is logged. The system captures team health, dynamics, and execution quality throughout the event lifecycle.

COHORT LAYER — The full-picture view across all trainees and all teams for a given program year. This is the primary view for MEST leadership when making investment decisions. The AI Role in This System AI in this system is NOT a decision-maker. It is an insight engine. It reads patterns across all the data the system collects and generates plain-language observations that help facilitators and leaders understand what is happening — things that would be hard to see manually across 30+ trainees and multiple teams. AI insights appear contextually throughout the platform. They surface on individual profiles, team dashboards, and cohort overviews. They are always framed as observations, never verdicts. The humans still make every call.

On individual profiles: growth trend summaries, strength and development area observations, participation pattern notes, flag context

On team dashboards: role balance analysis, collaboration pattern observations, execution velocity commentary, pivot impact notes

On cohort overview: cohort-wide engagement patterns, standout individual observations, risk summaries

On feedback links: synthesis of multiple evaluator responses into a readable summary for facilitators

SECTION 2 — HOW THE PROGRAM ACTUALLY WORKS The Program Journey Understanding the program flow is critical to designing the right UI. The system must mirror how the program actually unfolds — not impose an artificial structure on it. Phase Event Type What Happens Ongoing Classes & Workshops In-person sessions happening in parallel with all other activities. Attendance is tracked. Participation quality is observed. Multiple Startup Builds (SB1, SB2, SB3…) Trainees form teams of 3–4 and build a full business — from concept through prototype/MVP — over a defined period. Ends with a pitch. Teams are temporary, formed specifically for each Startup Build. The same trainee may be on different teams across different builds. Culmination Newco Trainees form their final startup team and build a real business. They pitch to MEST for actual investment. This is the highest-stakes event and where all longitudinal data converges. Attached to events Pitch Days / Demo Days Sub-events attached to a Startup Build or Newco. External judges are invited. Judge links are generated. Scores and comments are collected per KPI. Regular cadence Monthly Reviews Mentors submit structured evaluations for their assigned trainees and teams. This is a key source of qualitative signal alongside quantitative scores. Ad hoc Internal Reviews Facilitators can create check-in events at any point. Useful for mid-build assessments or course corrections. Key Nuances to Design Around

A trainee can be on different teams in different Startup Builds. Their individual profile aggregates performance across all of them.

Teams are event-scoped. You assign a team to a specific event when creating it.

Team composition can change mid-event. Member changes, pivots, and even full breakdowns are logged and become part of the record.

The feedback link system is flexible — links are generated for any event type, not just pitch days. A facilitator can generate supervisor feedback links for a mid-build check-in just as easily as for a formal pitch.

Classes are events too. Attendance and participation in classes feeds into individual profiles alongside pitch and build performance.

SECTION 3 — USER ROLES Who Uses This System Role Daily Usage Key Permissions Program Facilitator PRIMARY — uses system daily Full access. Creates cohorts, onboards trainees, manages teams and events, views all analytics, generates feedback links, logs observations, raises and resolves flags. MEST Leadership Periodic — funding decision periods Read-only analytics access. Sees funding readiness dashboards, longitudinal data, investment-relevant summaries. Cannot edit operational data. Judge (External) Single event only Tokenized link access. No login. Scores assigned teams on defined KPIs, leaves comments, submits. Link expires after submission. Mentor Weekly / Monthly Logs monthly structured reviews for assigned trainees and teams. Can raise flags. Cannot see other mentors' notes or unassigned trainees. Trainee Self-service view Read-only. Sees own profile, own team progress, own attendance, feedback addressed to them. Cannot see other trainees' profiles.

SECTION 4 — DESIGN SYSTEM Visual Language The design must feel authoritative, clean, and data-forward. This is a professional tool used by program staff and leadership — not a consumer app. Every visual element should serve a data or navigation purpose. No decorative UI. Color Palette Role Hex Usage Primary — Teal #0D9488 Main brand color. CTAs, active states, links, section headers, accent lines. Dark Charcoal #0F172A Primary text, headings, sidebar backgrounds. Soft Gray #F8FAFC Page backgrounds, card backgrounds, alternating table rows. White #FFFFFF Card surfaces, modal backgrounds, input fields. Success Green #16A34A Positive indicators, strong scores, resolved flags. Warning Amber #F59E0B Watch indicators, mid-range scores, pending flags. Risk Red #DC2626 Negative indicators, low scores, active risk flags, critical alerts. AI Purple #7C3AED AI-generated insight badges, insight panels, insight labels exclusively. Typography

Font Family: Inter (all weights). Google Fonts CDN.

Headings: Inter Bold. H1: 28–32px. H2: 22–24px. H3: 18–20px.

Body: Inter Regular 14–15px. Line height 1.6.

KPI Scores & Key Numbers: Inter SemiBold, larger size, teal or status color.

Labels and metadata: Inter Regular 12px, #64748B (slate-500). Layout & Navigation

Fixed left sidebar for main navigation. Collapsible on smaller screens.

Top bar with active cohort selector (dropdown), current user role indicator, and notification bell.

Main content area uses a 12-column grid. Cards and panels snap to grid.

No full-width text blocks. Content is always contained in cards or panels.

Modals for creation flows (create team, create event, etc.). Drawers for detail views (trainee profile, team profile).

Mobile responsive required for judge evaluation forms only. All other views are desktop-first. Component Patterns

Stat cards: Icon + large number + label + trend indicator (arrow up/down with percentage).

KPI score bars: Label left, color-coded progress bar center, numeric score right.

Status pills / badges: Rounded, color-coded. Active (teal), At Risk (red), Watch (amber), Completed (gray).

AI insight panels: Distinct purple-tinted background (#F5F3FF), small 'AI Insight' label in purple, italic text body.

Flag indicators: Red dot on trainee/team cards when an active unresolved flag exists.

Timeline entries: Left border accent line (teal), date stamp, event description.

Radar/spider charts: For team role balance visualization.

Line charts: For individual performance trends over time.

Trend sparklines: Compact, inline, for dashboard stat cards.

SECTION 5 — SCREEN-BY-SCREEN DESIGN SPECIFICATIONS The following 16 screens represent the complete required UI for V1. Each screen includes its purpose, all UI elements and components required, and the AI insight layer to surface on that screen. SCREEN 01 Login & Cohort Selection Primary User: All Roles Purpose The entry point to the system. After authentication, users land on a cohort selector before reaching any dashboard. The cohort selector is a distinct step — not buried in settings — because everything in the system is cohort-scoped. The selected cohort persists across the session and is always visible in the top nav. UI Elements & Components Required

Login form: email + password, MEST logo top center, teal CTA button

Post-login cohort selector screen: Grid of cohort cards (cohort name, year, status badge, trainee count, date range)

Option to create new cohort (for admins) directly from this screen

Selected cohort highlights in teal. 'Enter Cohort' CTA button.

Top nav cohort indicator: always-visible dropdown showing active cohort name with ability to switch

Role badge visible in top nav after login (e.g., 'Facilitator', 'Mentor', 'Leadership') AI Insight Layer No AI on this screen. Clean, fast entry. SCREEN 02 Cohort Dashboard Primary User: Facilitator, Leadership Purpose The home screen once a cohort is selected. This is the command center — a real-time overview of everything happening in the cohort. Designed for facilitators who open this every morning to see the state of the program. Must communicate both the big picture and surface what needs immediate attention. UI Elements & Components Required

Stat row (top): Total Trainees, Active Teams, Upcoming Events, Average KPI Score (cohort-wide), Attendance Rate — each as a stat card with sparkline trend

Attention Required panel: Trainees with active unresolved flags (red dots), teams with stability risk, trainees with dropping attendance — click any item to go to their profile

Active Events panel: Cards for each currently running event (name, type, days remaining, participating teams, completion status of evaluations)

Upcoming Events panel: Timeline view of next 30 days

High Potential / Low Visibility panel: Trainees the system has identified as strong performers who haven't had pitch/lead visibility yet

Recent Activity feed: Log of recent system actions (new scores submitted, flags raised, team changes, mentor reviews completed)

Quick Actions: Create Event, Add Trainee, Generate Feedback Link — accessible from dashboard without navigating away AI Insight Layer AI Insight Panel on cohort dashboard: A 3–5 sentence cohort health observation generated from patterns in the data — e.g., attendance trends this month, which teams are showing strong momentum, whether there are any emerging risk clusters. Refreshes when new data is added. Clearly labeled 'AI Cohort Snapshot' in purple. SCREEN 03 Trainee Roster & Onboarding Primary User: Facilitator Purpose The full list of all trainees in the cohort plus the onboarding flow for adding new trainees. Onboarding is the starting point for the entire data pipeline — getting trainees in accurately with their background information sets up everything downstream. UI Elements & Components Required

Trainee list: Table/grid view toggle. Columns: Photo, Name, Country, Entry Score, Attendance %, Avg KPI Score, Active Flag indicator, Current Team(s)

Search and filter bar: by country, skill level, flag status, attendance range, score range

Sort options: by name, score, attendance, flag status

Add Trainee button → slides open a drawer/modal with the onboarding form

Onboarding form fields: Full Name, Country (dropdown with African countries prioritized), Email, Photo upload, Bio (textarea), Technical Background (dropdown: None / Basic / Intermediate / Advanced), AI Skill Level (same scale), LinkedIn URL, GitHub URL, Portfolio URL, Entry Assessment Score (numeric input), Assigned Cohort (pre-filled), Notes (internal, not visible to trainee)

Bulk import option: CSV upload with field mapping interface

Status indicators on each row: shows if trainee has been on a team, if they've pitched, if they have an active flag

Click any trainee row → navigates to full Trainee Profile (Screen 04) AI Insight Layer No AI on this screen. Data entry focused. SCREEN 04 Trainee Profile — Full Longitudinal View Primary User: Facilitator, Mentor (assigned trainees only), Trainee (own profile) Purpose The most data-rich individual screen in the system. This is the complete picture of one trainee across the entire cohort. It must tell a story — not just show numbers — about how this person has grown, where they've struggled, what roles they've played, and how they've contributed across every team and event they've been part of. This is the screen that makes the 'quiet performer' visible. UI Elements & Components Required

Profile header: Photo, name, country flag, cohort badge, entry score, current team(s), role tags from all teams

Summary stat row: Attendance %, Avg KPI Score, Teams Participated, Pitches Delivered, Times in Lead Role, Mentor Rating Average

Performance trend chart: Line graph of KPI scores over time, each point labeled with the event name. Color-coded by event type.

Role history: Visual timeline of every team this trainee has been on, their role, the event, and their score in that event

Event participation breakdown: Accordion list of every event, their score per KPI, judge comments (attributed to judge or anonymous per facilitator setting)

Attendance record: Calendar heatmap or event-by-event log with present/absent/late status

Mentor reviews: Chronological list of all monthly reviews submitted by mentors, with scores and comments

Facilitator observation log: Private notes visible only to admins/facilitators. Timestamped free-text entries.

Flags: Active and resolved flags with context and resolution notes

Peer ratings: Aggregated anonymized peer rating scores (if peer review is enabled for any event)

Quiet Performer badge: Automatically displayed if the system detects high performance + low visibility pattern AI Insight Layer Full AI Insight panel on this screen. Generates: (1) Strength summary — what this person consistently does well based on score patterns and mentor notes. (2) Growth area summary — where scores are lower or declining. (3) Participation pattern note — observations about their engagement style (e.g., consistently scores higher in technical KPIs, less so in presentation). (4) Growth arc observation — whether trajectory is improving, plateauing, or declining. All framed as observations, not judgments. SCREEN 05 Team Formation & Team Roster Primary User: Facilitator Purpose The interface for creating teams and browsing all teams in the cohort. Teams are event-scoped, so the view should allow filtering by event. Creating a team is a deliberate, structured action — you pick the event, then select trainees from the pool, assign roles, and name the team. The roster view lets facilitators see all teams at a glance with their health status. UI Elements & Components Required

Team list: Cards grid. Each card shows: Team name, assigned event badge, member count, member avatar stack, product idea (if entered), stability indicator (green/amber/red dot), aggregate KPI score, active flag indicator

Filter by event, status (Active / Completed / Dissolved), flag status

Create Team button → modal/drawer with creation flow

Team creation flow: Step 1: Assign to Event (dropdown of active events). Step 2: Select 3–4 trainees from pool (shows their skill levels and current team assignments). Step 3: Assign roles to each member (Team Lead, Technical/CTO, Product/Business, Presenter — roles can overlap or be unassigned). Step 4: Name the team. Step 5: Add product idea and market focus (optional at creation, editable later).

Visual role balance indicator during team creation: shows which roles are filled as you assign them

Warning if creating a team with members who are already on a team for the same event

Click any team card → navigates to Team Profile (Screen 06) AI Insight Layer During team creation: After trainees are selected, an AI observation panel appears suggesting potential role fit based on their background and performance history. Framed as suggestions, not instructions. E.g., 'Based on past performance, [Name] has scored highest in technical KPIs — consider a technical role.' SCREEN 06 Team Profile & Health Dashboard Primary User: Facilitator, Mentor, Trainee (own team) Purpose The full profile of one team. Like the trainee profile, this must tell a story. A team's journey — how they formed, how they evolved, what they built, how they performed, and what happened when things got hard — should all be readable here. This is where the pivot log and breakdown log live. UI Elements & Components Required

Team header: Team name, event badge, formation date, current phase, product idea, market focus, stability badge (Stable / Evolving / At Risk)

Member cards: Each member shown with photo, name, role badge, individual KPI average, attendance rate, flag indicator

Aggregate performance panel: Overall team KPI score, breakdown by KPI, comparison to cohort average (above/below indicator)

Pivot Log: Chronological timeline of pivots. Each entry: date, what changed (product/market/model), reason, facilitator assessment of whether it was proactive or reactive.

Team Change Log: Any member additions or exits. Date, who left/joined, role affected, brief context.

Breakdown Log: If a serious conflict or breakdown was flagged — date, type, members involved, context, resolution/outcome.

Mentor reviews for this team: Monthly review scores and comments from assigned mentors.

Event performance history: All evaluations this team has received across all events, with KPI breakdowns.

Facilitator private notes: Internal observation log for this team.

Radar chart: Visualizing role balance across the 4 role dimensions — helps spot if one person is doing everything.

Action buttons: Log Pivot, Log Team Change, Raise Flag, Add Mentor Review, Generate Feedback Link AI Insight Layer AI Insight panel: (1) Team dynamics observation based on mentor reviews, flag history, and member change patterns. (2) Execution vs. presentation balance — are scores stronger on technical/execution KPIs or presentation/communication ones. (3) Pivot impact note — did performance improve or decline after pivots. (4) Role gap detection — which roles appear underserved based on scores. SCREEN 07 Event Creation & Management Primary User: Facilitator Purpose The interface for creating and managing events. An event is anything that generates tracked activity — a Startup Build, a class, a pitch day, an internal review, a Newco phase. Creating an event well sets up everything downstream: which teams participate, what KPIs are measured, who evaluates, and what feedback links are generated. UI Elements & Components Required

Event list: Table view. Columns: Event name, type badge, date range, participating teams count, evaluation completion %, status badge

Filter by event type, status, date range

Create Event button → drawer/modal with creation flow

Event creation flow: Step 1: Event name and type (dropdown: Startup Build, Newco, Class/Workshop, Internal Review, Demo/Pitch Day, Other). Step 2: Date range (start and end). Step 3: Assign participating teams (multi-select from team roster, or 'All Teams'). Step 4: KPI definition (links to KPI Builder — Screen 08). Step 5: Evaluation settings (who evaluates: judges only, mentors, facilitators, peers, or combination). Step 6: Generate feedback links (optional at creation, can do later).

Event detail view: Shows all participating teams, evaluation progress (how many teams have been scored, by how many evaluators), link management panel, KPI summary.

Status tracking: Not Started / In Progress / Evaluation Open / Evaluation Closed / Completed AI Insight Layer No AI at event creation. AI insights appear on event detail view after scores start coming in — a synthesis of early evaluation patterns if multiple judges have submitted. SCREEN 08 KPI Builder Primary User: Facilitator Purpose The tool for defining what gets measured in a given event. KPIs are the core unit of evaluation in this system. The builder must be flexible enough to handle pitch day scoring, class participation, internal reviews, and monthly check-ins. Facilitators can create from scratch or use templates. UI Elements & Components Required

Template library: Pre-built KPI sets for common event types (Pitch Day, Demo Day, Internal Review, Class Participation). Click to load, then customize.

KPI list for this event: Drag-to-reorder. Each KPI shown as a row with name, weight, scale, and required fields.

Add KPI button: Opens inline form or side panel

KPI creation fields: KPI Name (text), Description (textarea, shown to evaluators), Weight (numeric — system auto-normalizes all weights to 100%), Scale type (1–5 / 1–10 / Percentage / Custom range), Applies to (Team / Individual / Both), Require written comment (toggle), Show improvement recommendation field (toggle).

Weight distribution visualizer: As you add KPIs and set weights, a horizontal bar shows proportional distribution so facilitators can see at a glance how scoring weight is distributed.

Save as template option: Save the current KPI set for reuse in future events.

Preview button: Shows exactly how the KPI scoring form will appear to an evaluator. AI Insight Layer No AI in the builder itself. After first evaluations are submitted using these KPIs, AI can flag if any KPI has very low variance across all submissions (all judges scoring similarly — may indicate the KPI isn't differentiating well). SCREEN 09 Feedback Link Generation & Management Primary User: Facilitator Purpose The interface for generating, managing, and monitoring feedback links. These tokenized links can be sent to anyone — external judges, supervisors, industry experts, mentors who aren't in the system — for any event. This is one of the most flexible and frequently used features. Facilitators should be able to spin up a link in under 60 seconds. UI Elements & Components Required

Link management panel within an event's detail view

Generate Link button → quick form: Evaluator name (for tracking), evaluator email (optional, for reference), teams this evaluator will assess (multi-select), link expiry setting (date/time or after submission)

Generated link displayed with copy button and email share button

Active links list: Table showing evaluator name, teams assigned, status (Not Opened / Opened / Submitted), submission timestamp, link expiry

Bulk generation: 'Generate links for all judges' flow where you paste a list of names and emails and links are generated for all at once

Revoke link option per link

Submission status tracking: Real-time updates when a judge submits. Notification to facilitator.

Aggregate view: Once all/most links submitted, 'View Aggregate Results' button appears — goes to Screen 10 results view AI Insight Layer After multiple evaluators submit: AI synthesis note appears — a 2–3 sentence summary of consensus areas and notable divergence between evaluators (e.g., 'All evaluators scored technical depth highly. There was significant variation on business model — range of 3 to 9 out of 10.'). SCREEN 10 Judge / Evaluator Submission Form Primary User: Judge / External Evaluator (no login required) Purpose The externally accessible evaluation form reached via tokenized link. This screen has no login, no sidebar, no internal navigation. It is a focused, mobile-responsive form that a judge can complete on their phone after watching a pitch. It must be clean, fast, and never confusing. A judge should know exactly what they are scoring and why. UI Elements & Components Required

MEST branding top (logo + teal accent). No system navigation.

Event context: Event name, date, their assigned team(s) shown clearly.

For each team assigned: Team name, product idea, member names with roles, who pitched (highlighted), brief product description.

KPI scoring section for each team: Each KPI shown with its name, description, and scoring input (slider for numeric, clear labels for scale endpoints). Score displays numerically as slider moves.

Required comment field below each KPI (expands on focus). Character count indicator.

Optional improvement recommendation field (if enabled for that KPI).

Overall summary comment at the end (required).

Progress indicator: Shows completion % of form as judge works through it.

Submit button: Disabled until all required fields complete. Confirmation modal before final submit.

Post-submission screen: Thank you message, brief confirmation of what was submitted, link expires message. No ability to re-submit.

Mobile-responsive layout. Touch-friendly sliders. Large tap targets. AI Insight Layer No AI on this screen. The form is for data input only. SCREEN 11 Evaluation Results & Score Aggregation Primary User: Facilitator, Leadership Purpose After evaluations are submitted for an event, this screen shows the compiled results. It should surface consensus clearly, highlight where evaluators diverged, and make it easy to compare team performance side by side. This is where the scored data becomes actionable insight. UI Elements & Components Required

Event header with summary: Total evaluators submitted, total teams evaluated, evaluation completion %

Team comparison table: Teams as rows, KPIs as columns, aggregate score per cell. Sortable by any KPI or overall score.

Per-team drill-down: Click a team to see all individual evaluator scores side by side for each KPI, plus all written comments compiled.

Divergence indicators: Visual flag on KPIs where evaluator scores had high variance (one person scored very differently from others).

Top and bottom performers: Automatically surfaced — highest and lowest scoring teams, highest and lowest scoring KPIs cohort-wide.

Comment bank: All written comments compiled per KPI, readable in full. Evaluator attribution shown or anonymized per facilitator setting.

Export options: CSV of scores, PDF summary report.

Compare to past events: Toggle to overlay this event's team scores against their previous event scores. AI Insight Layer AI Insight panel: Synthesizes patterns across all evaluator submissions. What did the cohort do well collectively? Where did the most teams struggle? Any surprising divergences? Are there teams whose evaluator scores are at odds with their mentor review scores? Framed as observations to inform facilitator debriefs. SCREEN 12 Attendance Tracking Primary User: Facilitator Purpose Simple, fast attendance logging for every session and event. Must be quick enough that a facilitator can mark attendance for 30+ trainees in under 2 minutes. Designed for daily use — not a complex module. UI Elements & Components Required

Session list: Select the session/event to mark attendance for

Quick attendance interface: List of all trainees with three-button toggle per person: Present / Late / Absent. Defaults to Present so facilitator only needs to change exceptions.

Bulk actions: 'Mark all present' button, then change exceptions.

Notes field per trainee attendance entry (optional — for 'arrived after session started' or similar).

Attendance history per trainee: Accessible from their profile. Calendar view (heatmap) and event-by-event log.

Cohort attendance overview: Heatmap of attendance across all trainees and all sessions. Spots patterns at a glance.

Alerts: Trainees below threshold attendance (configurable — e.g., below 80%) are flagged automatically and appear in the 'Attention Required' panel on the cohort dashboard.

Attendance vs. performance correlation view: Scatter plot of attendance % vs. average KPI score for all trainees. AI Insight Layer AI observation on attendance patterns: If a trainee's attendance is declining over time (not just overall low, but trending downward), the system flags it with a note for the facilitator. 'Attendance for [Name] has dropped from 95% in the first month to 60% this month — may warrant a check-in.' SCREEN 13 Monthly Review Form (Mentor) Primary User: Mentor Purpose The structured monthly evaluation form that mentors complete for each of their assigned trainees and teams. This must be fast to complete — mentors should be able to do a thorough review in under 10 minutes. Structured fields ensure consistency across mentors and over time. UI Elements & Components Required

Review prompt: Shows which trainees/teams are due for a review this month

Individual review form per trainee: Progress rating 1–5 (labeled: 'What progress have you observed this month?'), Collaboration rating 1–5, Initiative rating 1–5, Growth observation (textarea — 'What growth have you noticed?'), Key challenge (textarea — 'What is the biggest challenge you're observing?'), Risk flag toggle (if flagged, requires explanation and severity: Low/Medium/High)

Team review form (if assigned to a team): Team cohesion rating 1–5, Execution quality rating 1–5, Communication rating 1–5, Team dynamics observation (textarea), Notable team-level concern (textarea)

Review history: Mentor can see their own past reviews for continuity

Submit button with confirmation

Facilitator sees all submitted mentor reviews aggregated on trainee and team profiles AI Insight Layer No AI at review submission. After submission, AI on trainee profile may update its insight summary based on new mentor review data. SCREEN 14 Pivot & Breakdown Logger Primary User: Facilitator Purpose A dedicated logging interface for recording significant team events — pivots in direction and team breakdowns or conflicts. These are first-class records in the system. They feed into stability scores and create a longitudinal narrative about team resilience and adaptability. UI Elements & Components Required

Access from Team Profile (Screen 06) or from a standalone 'Log Event' quick action

Pivot log entry form: Team (pre-filled if accessed from team profile), Event context, Date of pivot, Pivot type (dropdown: Product idea, Target market, Business model, Technical approach, Multiple), Description of what changed (textarea), Reason for pivot (textarea), Facilitator assessment: Was this proactive or reactive? (toggle), Did this pivot improve team direction? (optional assessment)

Team change log entry form: Team, Date, Change type (Member Exit / Member Joined / Role Change / Team Dissolution), Member involved, New composition (auto-updated from team roster), Context notes, Outcome (ongoing / resolved / team dissolved)

Breakdown log entry form: Team, Date, Breakdown type (Interpersonal conflict / Workload imbalance / Direction disagreement / External factor), Members involved, Context description, Resolution status (Ongoing / Resolved / Escalated), Resolution notes

All log entries appear on the team profile timeline in chronological order

Log entries are immutable once saved — facilitators can add notes but not edit the original record AI Insight Layer No AI at point of logging. Once several entries accumulate, AI on the team profile synthesizes patterns: e.g., 'This team has pivoted twice and experienced one member change. Post-pivot scores improved by an average of 12%, suggesting the changes were productive.' SCREEN 15 Cohort Analytics Overview Primary User: Facilitator, Leadership Purpose The high-level analytics view for the full cohort. This is where patterns across all individuals and all teams become visible. Designed for both facilitators doing weekly reviews and MEST leadership doing periodic strategic assessments. UI Elements & Components Required

Cohort performance summary: Average KPI score, attendance rate, number of events completed, teams formed vs. dissolved

Individual performance distribution: Histogram of all trainee scores — shows the spread across the cohort

Top performers panel: Top 10 trainees by aggregate score with trend indicators

High potential / low visibility panel: Trainees the system identifies as having strong scores but low pitch/lead activity

Team health overview: All teams plotted on a 2x2 matrix: X-axis = performance score, Y-axis = stability score. Each quadrant tells a story.

Event performance comparison: Bar chart comparing average scores across all events — shows if the cohort is improving over time

Attendance cohort map: Visual grid of all trainees × all sessions — shows attendance patterns across the cohort

Flag summary: How many flags raised this cohort, how many resolved, how many still active, breakdown by type

Mentor coverage: Are all trainees getting monthly reviews? Who hasn't had a review recently?

Export: CSV export of all cohort data, PDF executive summary AI Insight Layer Full AI Cohort Intelligence panel. Generates: (1) Cohort health narrative — 3–5 sentences on the overall state of the cohort based on all data signals. (2) Standout individuals — names and brief observations about trainees showing exceptional trajectory. (3) Teams to watch — teams showing either strong momentum or emerging risk. (4) Program-level observations — e.g., 'Technical scores across the cohort improved significantly after Startup Build 2, suggesting the curriculum adjustment had positive impact.' All clearly labeled as AI-generated observations. SCREEN 16 Newco & Investment Readiness View Primary User: Facilitator, MEST Leadership Purpose The final view — the one that matters most at the end of the program. When Newco begins, this screen becomes the reference for MEST's investment discussions. It surfaces everything: the team's full history, every individual's longitudinal record, all evaluations, all mentor feedback, all pivot and breakdown history — in a format designed for a leadership conversation, not a data dump. UI Elements & Components Required

Newco teams listed with overall program score (aggregate of all event scores, weighted by event type)

For each Newco team: Expandable card showing: Team name, product, market, member list with roles. Full performance summary card: aggregate score breakdown by category (technical, business, presentation, execution). Individual member profile summaries with their trajectory across the full program. Team history: how they formed, pivots taken, any breakdowns and how they recovered. Mentor composite rating. Judge scores from Newco pitch day.

Side-by-side team comparison view: Select 2–3 teams to compare across all dimensions

Individual standout flag: Automatically surfaces individuals in any Newco team who have exceptional longitudinal records — useful if MEST wants to note individuals separately from the team outcome

Evidence summary per team: A compiled readable summary of all the data signals for this team — written in plain language, not a table of numbers

Facilitator notes field: Space for final program observations before investment discussions

Print / Export: PDF export of any team's full evidence summary for offline use in discussions AI Insight Layer AI Evidence Summary: For each Newco team, the AI generates a plain-language narrative summary of everything the data shows about this team across the full program. It covers their performance arc, team stability, how they handled challenges, individual contributions, and where they showed the most growth. This is the AI's most substantive output in the system — not a score or a verdict, but a data-backed story to inform the humans making the actual call. Always ends with: 'This summary is generated from program data and is intended to support, not replace, facilitator and leadership judgment.'

SECTION 6 — IMPLEMENTATION NOTES FOR GOOGLE STITCH Priority Screens If Google Stitch requires prioritization, the following screens are highest priority for V1 design:

Screen 02 — Cohort Dashboard (the daily home)

Screen 04 — Trainee Profile (the most complex individual view)

Screen 06 — Team Profile (where team narrative lives)

Screen 10 — Judge/Evaluator Submission Form (external-facing, must be perfect)

Screen 15 — Cohort Analytics Overview (leadership view)

Screen 16 — Newco & Investment Readiness View (the culmination screen) What Success Looks Like A facilitator opens this system every morning and within 30 seconds knows: who needs attention today, what's happening this week, and whether the cohort is on track. A mentor completes a monthly review in under 10 minutes. An external judge submits a full evaluation on their phone in under 15 minutes. MEST leadership can sit in an investment discussion with a laptop open to Screen 16 and have confident, evidence-backed answers to any question about any team or individual. That is the product this UI needs to enable. What This System Is Not

Not a prediction engine. The AI generates observations, not scores or verdicts.

Not a replacement for human judgment. Every insight is advisory.

Not a consumer app. Design for professional, daily use — not first impressions.

Not a reporting tool. It is a live operational system that also generates reports. MEST Africa — Cohort & Performance Intelligence System · UI Design Brief V1.0
