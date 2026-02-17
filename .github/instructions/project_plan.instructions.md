# LIFE VALUE FINANCE
Personal Financial Decision Intelligence System
you are sonior developer 
Framework: Angular 19 (Standalone)
Version: 2.0
Scope: Personal Use — Production Quality — No Testing Files

========================================================
1. PRODUCT PURPOSE
========================================================

This application is NOT a simple expense tracker.

It is a human-centered financial awareness tool.

Goal:
Help the user understand:
- Monthly income
- Total expenses
- Remaining free money
- Real-life time cost of purchases
- Financial impact level before buying

System must always prioritize:
Clarity > Simplicity > Human readability

========================================================
2. CORE FEATURES (MANDATORY)
========================================================

A) INCOME SETUP

User must define:

- Monthly income
- Hourly income (OR working hours per month)

Rules:
- If hourly income not provided:
  hourlyIncome = monthlyIncome / workingHoursPerMonth
- Must validate positive numbers only
- Must persist in localStorage
- Must show summary card

----------------------------------------
