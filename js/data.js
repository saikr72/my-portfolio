/* ==========================================================================
   Portfolio content. Every section of the site is generated from this file.
   Edit copy here; no HTML or JS logic needs to change.

   Emphasis: wrap the one emphasised word of a headline in *asterisks*.
   It renders in Instrument Serif italic.

   Links: a link set to null is not rendered at all (never a "#" link).
   ========================================================================== */
window.PORTFOLIO = (function () {
  "use strict";

  var PROFILE = {
    name: "Sai Kumar",
    first: "SAI",
    last: "KUMAR",
    role: "Full-Stack Developer",
    kicker: "Full-Stack Developer · Available for select work",
    heroLine: "Building web applications that solve real-world *problems.*",
    sub: "I design and build complete web applications — from frontend interfaces and backend systems to databases, APIs, search and cloud infrastructure.",
    heroStack: ["PHP", "Laravel", "JavaScript", "React", "MySQL", "AWS"],
    email: "hello@saikumar.dev",
    links: {
      email: "mailto:hello@saikumar.dev",
      linkedin: "https://www.linkedin.com/in/saikumar-ravva-software-developer/",
      github: "https://github.com/saikr72",
      resume: null    // TODO: e.g. "assets/sai-kumar-resume.pdf"
    },
    footerStack: "Full-Stack Developer · PHP • Laravel • JavaScript • React • MySQL • AWS"
  };

  /* The 8 layers of the stack, top (Browser) to bottom (AWS).
     `colour` is the layer's edge colour, used in the hero, About,
     the request path and the tags. */
  var LAYERS = [
    { id: "browser",  label: "Browser",       tag: "Client",        colour: "#4F8EF7" },
    { id: "frontend", label: "Frontend",      tag: "React / Blade", colour: "#45A3E6" },
    { id: "api",      label: "API",           tag: "REST",          colour: "#3BB7C9" },
    { id: "laravel",  label: "Laravel",       tag: "Application",   colour: "#36B39A" },
    { id: "mysql",    label: "MySQL",         tag: "Database",      colour: "#4CB37A" },
    { id: "search",   label: "Search",        tag: "Elasticsearch", colour: "#A8C256" },
    { id: "external", label: "External APIs", tag: "PubChem",       colour: "#F2B33D" },
    { id: "aws",      label: "AWS",           tag: "Infrastructure", colour: "#FF7F00" }
  ];

  var NAV = [
    { label: "About",   href: "#about" },
    { label: "Stack",   href: "#stack" },
    { label: "Work",    href: "#work" },
    { label: "Journey", href: "#journey" },
    { label: "Contact", href: "#contact" }
  ];

  var LOADER = {
    messages: ["Compiling assets", "Running migrations", "Booting the stack"]
  };

  var MARQUEE = ["PHP", "Laravel", "JavaScript", "React", "MySQL", "AWS", "REST APIs", "Elasticsearch"];

  /* Chapter headings. */
  var CHAPTERS = {
    about:   { label: "CH 01", name: "About",          title: "Full-stack development from interface *to infrastructure.*" },
    stack:   { label: "CH 02", name: "The toolset",    title: "A map of what I build *with.*",
               sub: "Not a list of logos — a working set of tools I reach for depending on the layer of the problem." },
    work:    { label: "CH 03", name: "Selected work",  title: "Four systems. *Taken apart.*",
               sub: "Four systems I've built end-to-end. Open one to see the problem, the architecture and the result." },
    path:    { label: "CH 04", name: "A request's path", title: "What's happening behind the *interface?*",
               sub: "A request's actual path through a typical application I build." },
    data:    { label: "CH 05", name: "The data model", title: "Entities, *related.*",
               sub: "A simplified relationship map from a marketplace schema. Hover an entity to trace its relationships." },
    journey: { label: "CH 06", name: "Journey",        title: "Six years, one *direction.*" },
    experience: { label: "CH 07", name: "Experience",  title: "Where I've built *things.*" },
    contact: { label: "CH 08", name: "Contact",        title: "Let's build *something.*",
               sub: "Have an application, platform or technical challenge in mind?" }
  };

  var ABOUT = {
    copy: "I build complete web applications across the frontend, backend, database and infrastructure layers. Six years of shipping business applications, admin dashboards, APIs, data-driven platforms and integrations with external services — for chemical marketplaces, ed-tech platforms and internal business tools alike.",
    /* `layers` = ids from LAYERS that light up on the monolith for this area. */
    areas: [
      { num: "01", title: "Frontend",       text: "Building responsive and interactive interfaces with React, jQuery and modern CSS.", layers: ["browser", "frontend"] },
      { num: "02", title: "Backend",        text: "Building application logic, REST APIs and business workflows in Laravel.",       layers: ["api", "laravel"] },
      { num: "03", title: "Database",       text: "Designing and working with relational data, taxonomies and complex datasets.",    layers: ["mysql", "search"] },
      { num: "04", title: "Infrastructure", text: "Deploying and managing applications on AWS — EC2, RDS, S3, CloudWatch.",          layers: ["external", "aws"] }
    ]
  };

  /* Tech map. `colour` ties each group to the matching layer colour in LAYERS. */
  var SKILLS = [
    { group: "Frontend",    colour: "#45A3E6", items: ["HTML5", "CSS3", "JavaScript", "jQuery", "React JS", "Bootstrap 5"] },
    { group: "Backend",     colour: "#36B39A", items: ["PHP", "Laravel", "MVC", "REST APIs"] },
    { group: "Database",    colour: "#4CB37A", items: ["MySQL", "SQL Server", "MSSQL"] },
    { group: "Cloud",       colour: "#FF7F00", items: ["AWS EC2", "AWS RDS", "Amazon S3", "CloudWatch", "Load Balancing", "Auto Scaling"] },
    { group: "Data / APIs", colour: "#F2B33D", items: ["PubChem", "PUG REST", "Third-party APIs", "Data enrichment", "Excel processing"] },
    { group: "Search",      colour: "#A8C256", items: ["Elasticsearch", "Meilisearch"] },
    { group: "Tools",       colour: "#9CA3AF", items: ["Git", "GitHub", "GitLab", "Vite", "npm", "WordPress", "AdminLTE"] }
  ];

  var PROJECTS = [
    {
      idx: "01", id: "chemshopy", category: "B2B Chemical Marketplace", title: "ChemShopy",
      colour: "#0f5c52", textColour: "#F5F7FA",
      role: "Full-Stack Developer",
      stack: ["Laravel", "PHP", "MySQL", "Bootstrap", "AdminLTE", "JavaScript", "AWS", "REST APIs", "Elasticsearch"],
      problem: "Chemical suppliers and buyers had no shared platform to list products, request quotes and manage orders — deals were happening over email and spreadsheets, with no record of pricing history, product specs or order status.",
      architecture: ["User", "Frontend", "Laravel Application", "MySQL", "Search Engine", "PubChem / External APIs", "AWS"],
      flow: ["Supplier", "Product", "Search", "Quotation", "Purchase Order", "Payment", "Invoice"],
      features: ["Product catalog", "Supplier management", "Product taxonomy", "CAS number management", "PubChem API integration", "Product data enrichment", "Search", "Bulk Excel upload", "Quotations", "Purchase Orders", "Payments", "Invoices", "Notifications", "Activity tracking", "Reports", "Export"],
      challenge: "Chemical products needed reliable identification beyond free-text names — the same compound can carry several trade names. I integrated PubChem's PUG REST API against CAS numbers to pull verified compound data and enrich each product listing automatically, cutting down manual data entry and mismatched listings.",
      result: "A working Laravel 10 dashboard rebuilt module by module on a consistent Sneat-based UI — quotations, purchase orders, payments with generated payment links, invoices, activity logs and reporting all shipped as fully functional, no placeholder screens."
    },
    {
      idx: "02", id: "ai-learning", category: "AI / EdTech", title: "Test Mantra",
      colour: "#FF7F00", textColour: "#08090A",
      role: "Full-Stack Developer",
      stack: ["PHP", "MySQL", "JavaScript", "Laravel", "REST APIs"],
      problem: "JEE/NEET aspirants needed a single place to practice with previous-year and AI-generated questions, sit timed tests, and actually see where their preparation was weak — rather than switching between PDFs, YouTube and generic quiz apps.",
      architecture: ["Student", "Question Engine", "AI Generation", "Assessment", "Performance Store", "Analytics"],
      flow: ["Student", "Question", "AI Generation", "Assessment", "Performance", "Analytics"],
      features: ["Question generation", "Previous-year questions", "Online tests", "Student performance tracking", "Analytics dashboard", "Subscription system", "Personalized learning"],
      challenge: "Turning raw test attempts into something a student could act on meant building a performance layer that tracked accuracy by topic and difficulty over time, not just a final score per test.",
      result: "A functioning test-delivery and analytics flow for JEE/NEET prep — students take tests built from previous-year and generated questions, and see topic-level performance breakdowns rather than a single pass/fail number."
    },
    {
      idx: "03", id: "chem-data", category: "Data / API Integration", title: "Chemical Data Platform",
      colour: "#2b4fd6", textColour: "#F5F7FA",
      role: "Full-Stack Developer",
      stack: ["Laravel", "PHP", "MySQL", "PubChem PUG REST", "REST APIs"],
      problem: "Product listings needed accurate chemical data — molecular formula, structure, safety data — that suppliers rarely provided in a consistent format.",
      architecture: ["CAS Number", "PubChem API", "Chemical Data", "Data Enrichment", "Database", "Application"],
      flow: ["CAS Number", "PubChem API", "Chemical Data", "Data Enrichment", "Database", "Application"],
      features: ["API integration", "Data processing", "Chemical information lookup", "Database storage", "Automated data enrichment", "Search across enriched fields"],
      challenge: "PubChem's PUG REST API returns deeply nested compound records; I built a normalization layer that maps the fields that matter for a product listing into the application's own schema, with fallbacks when a CAS number has no direct match.",
      result: "An enrichment pipeline that takes a supplier's CAS number and returns a verified, searchable product record — reducing manual chemical-data entry across the ChemShopy catalog."
    },
    {
      idx: "04", id: "dashboards", category: "Web Application", title: "Business Dashboards",
      colour: "#efe9dd", textColour: "#08090A",
      role: "Full-Stack Developer",
      stack: ["Laravel", "PHP", "MySQL", "Bootstrap", "AdminLTE", "JavaScript"],
      problem: "Internal teams needed admin tooling — user management, reporting, activity visibility — that off-the-shelf CMS tools didn't fit, and that had to match each business's own workflow.",
      architecture: ["Browser", "Frontend", "Laravel Application", "MySQL", "Export / Reports"],
      flow: ["Requirements", "Schema", "CRUD", "Auth", "Reports", "Deploy"],
      features: ["CRUD", "Authentication", "User management", "Reports", "Analytics", "Notifications", "Activity tracking", "Export", "Search", "Filters"],
      challenge: "Every internal dashboard needs the same primitives — auth, CRUD, filtering, export — but a different information hierarchy. I built a reusable Laravel/AdminLTE base I could adapt per client rather than starting from zero each time.",
      result: "Multiple internal dashboards shipped with consistent, fully functional CRUD, role-based access, filtering, exports and activity logs — built to each business's actual workflow rather than a generic template."
    }
  ];

  var PROCESS = {
    title: "How I build.",
    sub: "The same seven-step sequence, every project — requirements to optimization.",
    steps: [
      { num: "01", title: "Understand", text: "Understand requirements and user flows." },
      { num: "02", title: "Architect",  text: "Design the application structure and database." },
      { num: "03", title: "Develop",    text: "Build frontend, backend and APIs." },
      { num: "04", title: "Integrate",  text: "Connect external APIs and services." },
      { num: "05", title: "Test",       text: "Validate functionality and edge cases." },
      { num: "06", title: "Deploy",     text: "Deploy and configure the application." },
      { num: "07", title: "Optimize",   text: "Improve performance, reliability and usability." }
    ]
  };

  var TIMELINE = [
    { year: "2018",        title: "Web Development",          text: "Started building websites — HTML, CSS and plain PHP against MySQL." },
    { year: "2019 – 2020", title: "PHP / MySQL Fundamentals", text: "Deepened backend fundamentals — relational schema design, server-side logic, form handling and auth." },
    { year: "2020 – 2021", title: "JavaScript",               text: "Moved from static pages to interactive interfaces with jQuery, then modern JavaScript." },
    { year: "2021 – 2022", title: "Laravel",                  text: "Adopted Laravel as a primary framework — MVC structure, Eloquent, queues and REST APIs." },
    { year: "2022 – 2023", title: "AWS",                      text: "Took applications to production on AWS — EC2, RDS, S3 and CloudWatch monitoring." },
    { year: "2023 – 2024", title: "APIs & Data",              text: "Built integrations with external data sources, including chemical data via PubChem's PUG REST API." },
    { year: "2024 – 2025", title: "Large Web Applications",   text: "Led the build of larger, multi-module platforms — marketplaces, dashboards and admin systems." },
    { year: "2025 – Now",  title: "Full-Stack Development",   text: "Working end-to-end across interface, application logic, data and infrastructure on every project." }
  ];

  /* Request path (Ch 04) uses LAYERS above, in order. */

  var ERD = {
    viewBox: "0 0 900 380",
    entities: [
      { id: "users",      label: "Users",      x: 90,  y: 60 },
      { id: "products",   label: "Products",   x: 90,  y: 200 },
      { id: "suppliers",  label: "Suppliers",  x: 90,  y: 320 },
      { id: "quotations", label: "Quotations", x: 420, y: 60 },
      { id: "orders",     label: "Orders",     x: 420, y: 200 },
      { id: "invoices",   label: "Invoices",   x: 420, y: 320 },
      { id: "payments",   label: "Payments",   x: 730, y: 200 }
    ],
    links: [
      ["users", "quotations"], ["users", "orders"],
      ["products", "orders"], ["products", "quotations"],
      ["suppliers", "products"],
      ["orders", "invoices"], ["orders", "payments"],
      ["invoices", "payments"]
    ],
    legend: ["Users → Orders, Quotations", "Products → Orders, Suppliers", "Orders → Payments, Invoices"]
  };

  var TERMINALS = {
    api: {
      title: "api-demo.sh",
      heading: "A request, end to end.",
      sub: "This is roughly what happens under a single GET request.",
      lines: [
        { prompt: "$", text: "curl -X GET https://api.chemshopy.com/products" },
        { text: "→ Request received by Laravel Controller" },
        { text: "→ Passed to ProductService" },
        { text: "→ Query executed against MySQL" },
        { text: "← 200 OK" },
        { text: "{" },
        { text: "  \"data\": [{ \"id\": 4821, \"name\": \"Sodium Benzoate\", \"cas\": \"532-32-1\" }]," },
        { text: "  \"meta\": { \"count\": 1284, \"page\": 1 }" },
        { text: "}" }
      ]
    },
    whoami: {
      title: "sai@dev ~",
      lines: [
        { prompt: "$", text: "whoami" },
        { text: "Full-Stack Developer" },
        { prompt: "$", text: "stack" },
        { text: "PHP · Laravel · JavaScript · React · MySQL · AWS" },
        { prompt: "$", text: "focus" },
        { text: "Web Applications · APIs · Databases · Cloud · Performance" }
      ]
    }
  };

  var EXPERIENCE = [
    {
      period: "2024 — Present",
      title: "ChemShopy — B2B Chemical Marketplace",
      role: "Full-Stack Developer",
      points: [
        "Rebuilt the marketplace's Laravel 10 admin dashboard, module by module, on a Sneat-based UI.",
        "Shipped Quotations, Purchase Orders, Payments, Invoices, Activity Logs, Export and Reports as fully functional modules.",
        "Integrated PubChem's PUG REST API for CAS-number lookups and chemical product data enrichment.",
        "Built bulk Excel upload for supplier product catalogs and payment-link generation for the payments flow."
      ],
      stack: ["Laravel", "MySQL", "Bootstrap", "AdminLTE", "AWS"]
    },
    {
      period: "2023 — 2024",
      title: "Test Mantra — AI Exam Prep Platform",
      role: "Full-Stack Developer",
      points: [
        "Built platform features for JEE/NEET exam preparation, including test delivery and performance tracking.",
        "Worked on the student-facing question and assessment flow feeding into an analytics layer."
      ],
      stack: ["PHP", "MySQL", "JavaScript"]
    },
    {
      period: "2018 — 2023",
      title: "Independent & Freelance Web Development",
      role: "Full-Stack Developer",
      points: [
        "Delivered business dashboards, CMS builds and internal tools for a range of clients on Laravel and WordPress.",
        "Handled full project lifecycle — requirements, database design, development, deployment and support."
      ],
      stack: ["PHP", "Laravel", "WordPress", "MySQL"]
    }
  ];

  var CONTACT = {
    resumeHeading: "Want to know more?"
  };

  return {
    PROFILE: PROFILE, LAYERS: LAYERS, NAV: NAV, LOADER: LOADER, MARQUEE: MARQUEE,
    CHAPTERS: CHAPTERS, ABOUT: ABOUT, SKILLS: SKILLS, PROJECTS: PROJECTS,
    PROCESS: PROCESS, TIMELINE: TIMELINE, ERD: ERD, TERMINALS: TERMINALS,
    EXPERIENCE: EXPERIENCE, CONTACT: CONTACT
  };
})();
