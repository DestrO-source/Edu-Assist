export const sampleDocuments = [
  { id: 'd1', name: 'Introduction to Information Systems.pdf', type: 'pdf', subject: 'Information Systems', size: '2.4 MB', date: 'Today', kind: 'Notes' },
  { id: 'd2', name: 'Database Systems — Revision Notes.docx', type: 'doc', subject: 'Database Systems', size: '840 KB', date: 'Yesterday', kind: 'Notes' },
  { id: 'd3', name: 'Software Development 2024 Paper 1.pdf', type: 'pdf', subject: 'Software Development', size: '1.8 MB', date: '12 Nov 2026', kind: 'Question paper' },
  { id: 'd4', name: 'Software Development 2024 Memo.pdf', type: 'pdf', subject: 'Software Development', size: '620 KB', date: '12 Nov 2026', kind: 'Memorandum' },
  { id: 'd5', name: 'Networks — Unit 3 slides.pptx', type: 'slides', subject: 'Computer Networks', size: '4.1 MB', date: '10 Nov 2026', kind: 'Slides' },
  { id: 'd6', name: 'Project milestones and rubric.docx', type: 'doc', subject: 'Software Development', size: '380 KB', date: '8 Nov 2026', kind: 'Assignment' }
];
export const sampleTasks = [
  { id: 't1', title: 'Review database normalisation', subject: 'Database Systems', due: 'Today · 14:00', tag: 'Study', progress: 45, done: false },
  { id: 't2', title: 'Complete networks practice quiz', subject: 'Computer Networks', due: 'Today · 16:30', tag: 'Practice', progress: 15, done: false },
  { id: 't3', title: 'Submit project progress report', subject: 'Software Development', due: 'Tomorrow', tag: 'Assignment', progress: 0, done: false },
  { id: 't4', title: 'Read chapter 6: system analysis', subject: 'Information Systems', due: '19 Nov', tag: 'Reading', progress: 100, done: true }
];
export const sampleSessions = [
  { time: '09:00', title: 'Database Systems', detail: 'Normalisation · 45 min' },
  { time: '11:30', title: 'Computer Networks', detail: 'Practice questions · 30 min' },
  { time: '14:00', title: 'Project work', detail: 'Progress report · 60 min' }
];
export const sampleQuizzes = [
  { id: 'q1', title: 'Database Fundamentals', subject: 'Database Systems', questions: 5, minutes: 5, icon: '▦', color: 'lilac', questionsData: [
    { prompt: 'What is the main purpose of database normalisation?', options: ['To reduce data redundancy and improve integrity', 'To make tables larger', 'To encrypt all database values', 'To replace the need for keys'], answer: 0 },
    { prompt: 'Which key uniquely identifies each row in a table?', options: ['Foreign key', 'Primary key', 'Composite attribute', 'Index view'], answer: 1 },
    { prompt: 'A foreign key is used to…', options: ['Sort records alphabetically', 'Link related tables', 'Back up a database', 'Store passwords only'], answer: 1 },
    { prompt: 'In a relational database, a row is also called a…', options: ['Field', 'Tuple or record', 'Schema', 'Query'], answer: 1 },
    { prompt: 'Which SQL command retrieves data?', options: ['SELECT', 'PUSH', 'FETCHFILE', 'READTABLE'], answer: 0 }
  ]},
  { id: 'q2', title: 'Networking Essentials', subject: 'Computer Networks', questions: 5, minutes: 5, icon: '⌁', color: 'green', questionsData: [
    { prompt: 'Which device forwards data between different networks?', options: ['Switch', 'Router', 'Hub', 'Repeater'], answer: 1 },
    { prompt: 'What does IP stand for?', options: ['Internet Protocol', 'Internal Process', 'Interface Program', 'Integrated Port'], answer: 0 },
    { prompt: 'Which protocol is commonly used for secure web browsing?', options: ['HTTP', 'FTP', 'HTTPS', 'SMTP'], answer: 2 },
    { prompt: 'How many layers are in the OSI model?', options: ['4', '5', '6', '7'], answer: 3 },
    { prompt: 'A LAN typically covers…', options: ['A small local area', 'An entire continent', 'Only the internet backbone', 'Multiple countries'], answer: 0 }
  ]},
  { id: 'q3', title: 'Systems Analysis Basics', subject: 'Information Systems', questions: 5, minutes: 5, icon: '◎', color: 'orange', questionsData: [
    { prompt: 'What is a key goal of requirements analysis?', options: ['Understand what users and stakeholders need', 'Choose a logo', 'Write all production code', 'Purchase hardware'], answer: 0 },
    { prompt: 'A use case describes…', options: ['How an actor interacts with a system to reach a goal', 'A database backup', 'A network cable', 'A programming language'], answer: 0 },
    { prompt: 'Which is a non-functional requirement?', options: ['User can reset a password', 'System responds within two seconds', 'Student can upload notes', 'Lecturer can create a class'], answer: 1 },
    { prompt: 'Who is a stakeholder?', options: ['Anyone affected by or interested in the system', 'Only the programmer', 'Only the network router', 'A database field'], answer: 0 },
    { prompt: 'A prototype is useful because it…', options: ['Helps gather feedback on an early model', 'Replaces all testing', 'Guarantees a project is on time', 'Removes stakeholder input'], answer: 0 }
  ]},
  { id: 'q4', title: 'Software Development', subject: 'Software Development', questions: 5, minutes: 5, icon: '⌘', color: 'blue', questionsData: [
    { prompt: 'What is the purpose of version control?', options: ['Track and manage changes to source files', 'Run a web browser', 'Compress every image', 'Replace documentation'], answer: 0 },
    { prompt: 'Unit testing focuses on…', options: ['Individual pieces of code', 'The entire organisation', 'User interface colours only', 'Network installation'], answer: 0 },
    { prompt: 'What does an iterative development approach do?', options: ['Builds and improves in repeated cycles', 'Finishes all planning after launch', 'Avoids feedback', 'Only works without users'], answer: 0 },
    { prompt: 'A software requirement should be…', options: ['Clear and testable', 'Hidden from the team', 'Written only after launch', 'Intentionally ambiguous'], answer: 0 },
    { prompt: 'What is a code review?', options: ['A teammate examines code for quality and issues', 'A database query', 'A meeting-free release', 'A backup schedule'], answer: 0 }
  ]}
];
