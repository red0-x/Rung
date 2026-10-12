# Rung
 
Gmail Priority Inbox for phone support. Never on hold. Never a stranger.
 
2nd place overall at SpeedHacks and Best Use of Dial.
 
<img width="700" alt="Rung landing page" src="https://github.com/user-attachments/assets/bccd3f27-3eec-4438-85ff-b6291cd4d09b" />

 
## The problem
 
Calling support means waiting on hold, then explaining everything from scratch to a rep who spends the first few minutes catching up. Both sides lose time, and the most urgent caller waits in the same line as everyone else.
 
## What Rung does
 
- Nobody holds: an AI voice agent answers every call instantly on a real phone number.
- The rep never starts cold: the agent writes a three-line brief (what happened, what they tried, what they want).
- The right call first: every caller is ranked by urgency + money at stake + minutes waited, with a "why ranked here" reason. Waiting keeps adding points, so small issues are never stuck.
- Never a stranger: Rung recognizes the caller's number, so the next call starts with "Hi Reid, I've got your details up." Memory is kept per company and never shared across companies.
- A human calls back, most urgent first. Reps press "Take next" and never collide on the same caller.
<p>
  <img width="49%" alt="Call and brief" src="https://github.com/user-attachments/assets/c074268c-9bac-479a-9f84-50b3b8cae0dc" />
  <img width="49%" alt="Callback queue" src="https://github.com/user-attachments/assets/324ccbbb-3399-46cd-867d-db37530f8cc7" />
</p>

 
## Time and money saved (illustrative model)
 
For a bank taking 1,000 calls a day: callers skip ~380 hours of hold per day, and reps skip ~1.5 minutes of catching up per call. A rep minute costs ~$0.62 and Rung costs $0.30 per AI minute, so the bank saves ~$10,000/month after paying for Rung.
 
## How we used partner tech
 
- Dial: each company gets a Dial phone number and AI voice agent. Our Setup page publishes the agent's prompt and tools. During the call, Dial's agent calls our MCP tools (`lookup_caller`, `triage_call`, `save_profile`) to recognize the caller and file the brief. After the call, Dial sends the call length and transcript. Dial meant we built no phone system and had real calls working the same day.
- Keewano: every call sends an event (no names or phone numbers) to Keewano. The Insights tab asks Keewano for the day's trends: calls by urgency, returning callers, callbacks. That gave us a dashboard without building analytics.
## Try it
 
Live site: https://www.tryrung.today
 
## Stack
 
Dial, Keewano, Supabase (Postgres), React, TypeScript, MCP, built with Claude Code
 
