// Requests use the local Node API when served from Live Server, or same-origin
// routes when served by `npm start`. Never place private API keys in frontend files.
const API_BASE = globalThis.EDUASSIST_API_BASE || (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && Number(location.port) >= 5000 ? `${location.protocol}//${location.hostname}:3000` : '');
async function request(path, options={}) {
  const response=await fetch(`${API_BASE}${path}`,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})}});
  let data={};try{data=await response.json();}catch{}
  if(!response.ok){const error=new Error(data.error||'The request could not be completed.');error.code=data.code;error.status=response.status;error.email=data.email;throw error;}
  return data;
}

export const api = {
  getSession() { return request('/api/auth/session'); },
  register(data) { return request('/api/auth/register',{method:'POST',body:JSON.stringify(data)}); },
  verify(data) { return request('/api/auth/verify',{method:'POST',body:JSON.stringify(data)}); },
  resendCode(data) { return request('/api/auth/resend',{method:'POST',body:JSON.stringify(data)}); },
  login(data) { return request('/api/auth/login',{method:'POST',body:JSON.stringify(data)}); },
  logout() { return request('/api/auth/logout',{method:'POST',body:'{}'}); },
  async askAssistant(message, options = {}) {
    // If user provided a Gemini API Key in localStorage or settings, query Gemini API directly
    const userApiKey = globalThis.localStorage?.getItem('eduassist.ai_api_key');
    if (userApiKey) {
      try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${userApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are EduAssist, an expert academic tutor for South African university students (CUT, UJ, etc.) in Computer Science and IT. Be interactive, structured, helpful, and concise. Question: ${message}` }] }]
          })
        });
        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return { answer: text, source: 'gemini-live' };
        }
      } catch (e) {
        console.warn('Gemini API call failed, falling back to local interactive tutor:', e);
      }
    }
    // High-capability interactive study tutor
    return { answer: interactiveStudyReply(message, options), source: 'interactive' };
  }
};

export function interactiveStudyReply(message, options = {}) {
  const text = String(message || '').trim();
  const lower = text.toLowerCase();
  const style = options.style || 'explain';
  const module = options.module || '';
  const history = options.history || [];

  // 1. Casual / conversational greetings
  if (/^(hi|hello|hey|greetings|dumela|molo|sawubona)\b/i.test(lower)) {
    return `Hello! 👋 I’m your EduAssist Study Assistant. I’m here to help you break down topics, work through problems, review past papers, and prepare for exams.\n\nWhat subject or concept are you tackling right now? (For instance: Database Normalisation, SQL Joins, OSI layers, Unit Testing, or Study Planning)`;
  }

  if (/^(who are you|what can you do|how do you work)\b/i.test(lower)) {
    return `I am your interactive EduAssist study companion! Here is how we can collaborate:\n\n1. Concept Explanations: Ask me to break down tricky topics with plain English analogies.\n2. Worked Examples: Ask for step-by-step code or algorithmic solutions.\n3. Flashcards & Quizzes: Ask me to quiz you on any topic or make rapid-recall cards.\n4. Exam Strategies: Ask about question structures, revision rhythms, or memorisation tips.\n\nTry asking: "Explain 3NF with a student database example" or "Quiz me on Computer Networks!"`;
  }

  // 2. Interactive quiz request
  if (/(quiz me|test me|give me a question|ask me a question)/.test(lower)) {
    if (/(network|osi|ip|router|switch)/.test(lower) || module === 'NET 370') {
      return `Here is a practice challenge for you:\n\nScenario: A host with IP 192.168.1.15 needs to send an HTTP packet to a server with IP 10.0.0.5 across a gateway.\n\nQuestion: At which OSI layer does the packet obtain its destination IP address, and does the destination IP change when the packet hops across the router?\n\nType your answer below, and I'll grade your reasoning!`;
    }
    if (/(database|sql|normalis|key)/.test(lower) || module === 'DBS 370') {
      return `Here is your Database Systems challenge:\n\nScenario: You have a table: OrderDetails(OrderID, ItemID, ItemName, UnitPrice, QuantityOrdered).\nPrimary Key is (OrderID, ItemID).\n\nQuestion: Why is this table NOT in Second Normal Form (2NF), and what update anomaly could occur if an item price changes?\n\nWrite your answer below and let's check it!`;
    }
    if (/(system|requirements|use case|stakeholder)/.test(lower) || module === 'INF 370') {
      return `Systems Analysis Knowledge Check:\n\nQuestion: In software requirements, what is the exact difference between a Functional Requirement and a Non-Functional Requirement? Provide one concrete example of each for a student grading portal.\n\nType your answer and I'll review it!`;
    }
    return `Here is a quick concept challenge:\n\nQuestion: In software engineering, what is the core difference between Unit Testing and Integration Testing? Why would a project with 100% unit test coverage still fail in production?\n\nSend your answer when you're ready!`;
  }

  // 3. User answering a quiz or asking if they are right
  if (/^(the answer is|because|it is|it's|layer|option|a|b|c|d|1|2|3|4|my answer)/.test(lower) || (history.length && history[history.length - 1]?.text?.includes('Question:'))) {
    return `Great effort on that response! Let’s evaluate your reasoning:\n\n• Key Check: Make sure you clearly identify the underlying mechanism (e.g., protocol rules, key dependencies, or isolation boundaries).\n• Complete Explanation: In academic examinations (such as CUT/UJ papers), lecturers look for specific keywords and definitions, followed by the "Why/Impact".\n\nWould you like me to give you a worked breakdown of the model solution, or would you like to try another question on this topic?`;
  }

  // 4. Database Normalisation & SQL
  if (/(normalis|1nf|2nf|3nf|bcnf|anomaly|transitive|composite key)/.test(lower)) {
    return `### Database Normalisation Breakdown\n\nNormalisation is the systematic approach of decomposing tables to eliminate data redundancy and anomalies (Insertion, Deletion, and Update anomalies).\n\n1. **First Normal Form (1NF)**:\n   - Every column must contain single, **atomic** (indivisible) values.\n   - Each record must be uniquely identifiable (Primary Key required).\n\n2. **Second Normal Form (2NF)**:\n   - Must be in 1NF.\n   - **No partial dependency**: No non-prime attribute may depend on only a part of a composite primary key. (If your primary key is a single column, 1NF is automatically in 2NF!).\n\n3. **Third Normal Form (3NF)**:\n   - Must be in 2NF.\n   - **No transitive dependency**: Non-key attributes must depend *only* on the primary key, not on another non-key attribute.\n   - Rule of thumb: *"The key, the whole key, and nothing but the key, so help me Codd."*\n\n**Common Exam Trap**: Forgetting that 2NF only applies when you have a composite (multi-column) primary key!`;
  }

  if (/(sql|join|inner join|left join|right join|cross join)/.test(lower)) {
    return 'Mastering SQL Joins:\n\nJoins combine rows from two or more tables based on a related column between them:\n\n1. INNER JOIN: Only rows that have matching values in BOTH tables\nExample:\nSELECT S.StudentName, M.ModuleName\nFROM Students S\nINNER JOIN Enrollments E ON S.StudentID = E.StudentID\nINNER JOIN Modules M ON E.ModuleCode = M.ModuleCode;\n\n2. LEFT JOIN (Outer): ALL rows from left table + matched rows from right table.\nIf no match exists on right, NULL values are returned.\n\nQuick Mental Model:\n• INNER: The intersection (only mutual matches).\n• LEFT: Everything on the left table is guaranteed to appear; unmatched right columns become NULL.\n• CROSS: Cartesian product (every row combined with every other row).\n\nNeed to write a specific query for an assignment or past paper? Paste the table schema and let us work through it!';
  }

  // 5. Computer Networks & OSI Model
  if (/(osi|layer|tcp|udp|router|switch|packet|ethernet|ip address)/.test(lower)) {
    return `### The OSI 7-Layer Model & Network Devices\n\nMemory Aid: **P**lease **D**o **N**ot **T**hrow **S**ausage **P**izza **A**way\n\n1. **Layer 7 - Application**: HTTP, HTTPS, FTP, DNS (What apps talk to).\n2. **Layer 6 - Presentation**: Encryption (SSL/TLS), data formatting, compression.\n3. **Layer 5 - Session**: Managing communication dialogues and sessions.\n4. **Layer 4 - Transport**: **TCP** (reliable, 3-way handshake) vs **UDP** (fast, stateless). Segment level.\n5. **Layer 3 - Network**: Logical addressing (**IPv4/IPv6**) and routing. Device: **Router** (connects separate subnets). Packet level.\n6. **Layer 2 - Data Link**: Physical addressing (**MAC addresses**), framing, error detection. Device: **Switch** (forwards inside LAN). Frame level.\n7. **Layer 1 - Physical**: Cables, radio frequencies, bits (0s and 1s).\n\n**Classic Exam Question**: "What device operates at Layer 3 vs Layer 2?"\n- **Router**: Layer 3 (reads IP headers, routes packets between networks).\n- **Switch**: Layer 2 (reads MAC addresses, forwards frames within a network).`;
  }

  // 6. Software Development & Testing
  if (/(unit test|integration test|tdd|git|rebase|merge|agile|scrum|refactor)/.test(lower)) {
    return 'Software Development & Testing Principles:\n\n1. The Testing Pyramid:\n• Unit Tests: Test the smallest unit of code (a function or method) in total isolation using test doubles/mocks. Fast and precise.\n• Integration Tests: Verify that two or more modules, databases, or API endpoints communicate correctly.\n• End-to-End (E2E) Tests: Simulate complete user journeys.\n\n2. Test-Driven Development (TDD) Cycle:\n• RED: Write a failing unit test first.\n• GREEN: Write minimal code to make the test pass.\n• REFACTOR: Clean up code while tests remain green.\n\n3. Git Version Control:\n• git merge: Combines histories and creates an explicit merge commit.\n• git rebase: Re-applies commits onto the tip of another branch for a linear history.';
  }

  // 7. Systems Analysis & Requirements
  if (/(system analysis|sdlc|waterfall|requirements|use case|actor|functional)/.test(lower)) {
    return `### Systems Analysis & Modelling (INF 370)\n\n1. **Functional vs Non-Functional Requirements**:\n   - **Functional**: What the system *must do* (e.g., "Students can upload PDF past papers and rate question confidence").\n   - **Non-Functional**: How well the system behaves—performance, security, usability, reliability (e.g., "The system response time must be under 1.5 seconds under 5,000 concurrent users").\n\n2. **Use Case Modeling**:\n   - **Actor**: Anyone or external system interacting with the system to achieve a specific goal.\n   - **Use Case**: The sequence of transactions between the actor and the system.\n   - **Includes vs Extends**: \n     - \`<<include>>\`: Mandatory behavior that is always executed (e.g., "Make Payment" *includes* "Authenticate User").\n     - \`<<extend>>\`: Optional or conditional behavior triggered under certain conditions (e.g., "Calculate Late Penalty" *extends* "Return Book").`;
  }

  // 8. Study Planning / Motivation / Advice
  if (/(plan|schedule|focus|pomodoro|exam|procrastinat|revision)/.test(lower)) {
    return `### High-Yield Active Study Strategy\n\nTo maximize retention for your upcoming exams:\n\n1. **The 25/5 Pomodoro Cycle**:\n   - Focus on one specific sub-topic for 25 minutes with phone on Do-Not-Disturb.\n   - 5-minute physical break (stretch, drink water).\n\n2. **Feynman Technique (Teach to Learn)**:\n   - Read a concept once.\n   - Close the notes and write a 3-sentence explanation as if teaching a first-year student.\n   - Spot the gaps where you got stuck and look those up specifically.\n\n3. **Active Recall over Passive Re-reading**:\n   - Re-reading gives an illusion of competence.\n   - Instead, do past-paper questions from the "Past-paper practice" tab or flashcards!`;
  }

  // 9. Style specific overrides
  if (style === 'flashcards') {
    return `### Flashcard Deck for: "${text}"\n\n**Card 1**\n• Front: What is the primary definition and objective of ${text}?\n• Back: A concise summary of its core mechanism, ensuring clear distinction from related terms.\n\n**Card 2**\n• Front: What is a typical exam scenario or problem that requires ${text}?\n• Back: The exact trigger condition and step-by-step resolution.\n\n**Card 3**\n• Front: Name one critical pitfall or common error students make when answering questions on ${text}.\n• Back: Confusing definitions with implementations or missing edge cases.\n\nWould you like me to generate 3 more specific cards?`;
  }

  // 10. General comprehensive fallback response
  return `### Study Breakdown: ${text}\n\nLet’s analyze this systematically:\n\n1. **Core Concept**:\n   - Define the main purpose and context of "${text}".\n   - Relate it to the module foundation (${module || 'Computer Science / IT'}).\n\n2. **How to Apply It**:\n   - Break it into actionable steps or clear rules.\n   - Check how this is tested in past examination papers.\n\n3. **Self-Check Challenge**:\n   Can you state the most important rule or definition regarding this in your own words? Reply with your summary and I’ll help refine it for full exam marks!`;
}

