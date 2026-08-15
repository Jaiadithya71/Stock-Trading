# Project T - Requirements & Specification Document

This document records the project goals, trading strategy rules, risk parameters, and user preferences collected from the **Project Requirements Questionnaire** (`Initial Assumption.docx`).

---

## Section 1: The Big Picture

### Q1: In one or two sentences, what should this system help you do that you can't do today?
* **Answer**: To look at all the different market movements and be able to make quick buy and sell actions on specific stocks and futures. *(Note: Working under baseline assumptions prior to receiving final client specifications).*

### Q2: Is the end goal automatic trade placement, or do you want a manual approval step before any trade executes?
* **Answer**: To be decided *(Architect to support both full automated execution and manual 1-click confirmation mode via a toggle)*.

### Q3: Walk me through your morning once this is fully built — how would you actually use it while trading?
* **Answer**: Will clarify with the actual client.

### Q4: What does "success" look like for you (e.g., more winning trades, fewer losses, catching moves you currently miss)?
* **Answer**: Will clarify with the actual client.

---

## Section 2: What's Already Built (Confirming the 25%)

### Q5: Could you re-list (or confirm) every indicator, timeframe, currency pair, and sentiment measure you originally wanted tracked?
* **Answer**: Confirmed complete. The existing baseline features (1m, 3m, 5m, 15m, 30m, 1h intervals; Bank Nifty spot/futures, Nifty 50, India VIX; 12 constituent banking stocks; 1-min automated PCR sentiment engine; USD/EUR/GBP/JPY-INR currency pairs; live NSE Option Chain) cover the full required scope.

### Q6: Are there any new indicators you want added now, on top of your original list?
* **Answer**: None for now. Maintain current indicator set without adding new indicators at this stage.

---

## Section 3: The Trading Strategy & Auto-Execution

### Q7: Do you have a current trading strategy or set of rules already written down? If yes, please describe it in plain language.
* **Answer**: Use Fibonacci retracement charts combined with price movement charts to analyze overall market context and make trade decisions.

### Q8: When the system decides to place a trade, what should trigger it? (e.g., "when RSI crosses X and VIX is below Y")
* **Answer**: Will test and obtain exact trigger conditions/rules from the client.

### Q9: How much money/quantity should the system risk per trade, and is there a daily loss limit it should stop at?
* **Answer**: Not sure yet *(Make risk-per-trade, max lot size, and daily loss limit user-configurable parameters in the system settings)*.

### Q10: Should there be a manual "kill switch" to pause all auto-trading instantly if something looks wrong?
* **Answer**: Yes. Implement a prominent Emergency Kill Switch button on the dashboard to immediately pause trading and block order execution.

### Q11: We're using SmartAPI (Angel One) to place orders — can you confirm this is the account/broker you want live trades going through?
* **Answer**: *(Pending)*

### Q12: For now we'll build this on fixed rules you define rather than a self-learning AI/ML model. Does that work for you, or is ML a must-have from the start?
* **Answer**: *(Pending)*

---

## Section 4: Look, Feel & Usage

### Q13: Do you want to view/monitor this on a laptop, phone, or both?
* **Answer**: *(Pending)*

### Q14: How many things do you want visible on one screen — full detail, or a clean/minimal view with alerts only?
* **Answer**: *(Pending)*

---

## Section 5: Priorities & Trust

### Q15: Since this places real trades automatically, would you want a testing/paper-trading phase first before it uses real money?
* **Answer**: *(Pending)*

### Q16: If we can't build everything at once, what are the top 3 things you need working first?
* **Answer**: *(Pending)*


---
## Client Survey Submission (15/8/2026, 11:09:55 am)

- **Execution Mode**: Manual 1-Click Confirmation
- **Broker Target**: Angel One SmartAPI
- **Risk Controls**: Emergency Kill Switch, Daily Max Loss Limit
- **Instruments**: Bank Nifty Options & Futures
- **Custom Notes**: Test survey response
