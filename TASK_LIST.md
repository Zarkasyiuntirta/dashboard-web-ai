# Task List - Login & AI Chat Enhancements

## 1. Add NIK field to student data structure
- [x] Add `nik` field to studentDataset in dashboard.js
- [x] Add NIK column to student management table (Perbarui Murid)
- [x] Add NIK prompt when adding new student
- [x] Propagate NIK to subjectData

## 2. Update auth.js - Walimurid Login
- [x] Add walimurid login validation: username="Walimurid", password=NIK
- [x] Store walimurid identity info (student name, NIK, NIM) for dashboard
- [x] Role badge display for walimurid

## 3. Update index.html - UI Adjustments
- [x] Ensure AI Chat button visible for all roles (admin, student, walimurid)
- [x] Add NIK column header to student management table

## 4. Update dashboard.js - AI Chat Content & Navigation
- [x] Update getUserRoleFromUI() to detect walimurid
- [x] Update ensureChatAIInit() with role-based greetings:
  - Admin: sapa admin + AI Insight Engine, AI Early Warning System, AI Root Cause Analysis, AI Talent Detection, AI Smart Grouping, AI Intervention Planner, AI Progress Forecast, AI Executive Summary
  - Murid (student): sapa dengan nama sesuai NIM login + AI Insight Engine, AI Learning Coach, AI Talent Detection, AI Study Simulator, AI Progress Forecast, AI Achievement & Gamification
  - Walimurid: sapa dengan nama murid sesuai NIK login + AI Insight Engine, AI Early Warning System, AI Root Cause Analysis, AI Parenting Coach, AI Talent Detection, AI Intervention Planner, AI Progress Forecast, AI Executive Summary
- [x] Make AI Chat tab always visible in sidebar
- [x] Student login password uses NIM from Perbarui Murid data

## 5. Sync & Validate
- [x] All files updated and consistent