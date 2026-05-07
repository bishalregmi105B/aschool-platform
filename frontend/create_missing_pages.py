import os

missing_pages = [
    "/dashboard/certificates/id-settings",
    "/dashboard/certificates/staff",
    "/dashboard/certificates/staff-id",
    "/dashboard/certificates/student-id",
    "/dashboard/certificates/students",
    "/dashboard/communications/diary/categories",
    "/dashboard/exams/online/questions",
    "/dashboard/hr/expense-categories",
    "/dashboard/hr/expenses",
    "/dashboard/hr/leaves/report",
    "/dashboard/hr/payroll/settings",
    "/dashboard/hr/staff-attendance",
    "/dashboard/reports/exam",
    "/dashboard/reports/expense",
    "/dashboard/reports/teacher",
    "/dashboard/staff/bulk-upload",
    "/dashboard/students/profile-images",
    "/dashboard/teachers/bulk-upload",
    "/dashboard/timetable/teacher",
    "/dashboard/transport/allocation",
    "/dashboard/transport/pickup-points",
    "/dashboard/transport/routes"
]

base_dir = "/home/bishal-regmi/Desktop/ASchool/frontend/app"

for path in missing_pages:
    # remove leading slash
    rel_path = path.lstrip("/")
    dir_path = os.path.join(base_dir, rel_path)
    os.makedirs(dir_path, exist_ok=True)
    
    file_path = os.path.join(dir_path, "page.tsx")
    if not os.path.exists(file_path):
        # Create a basic functional component
        title = path.split("/")[-1].replace("-", " ").title()
        parent = path.split("/")[-2].replace("-", " ").title() if len(path.split("/")) > 2 else "Dashboard"
        
        content = f"""export default function {title.replace(' ', '')}Page() {{
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{parent} — {title}</h1>
        <p className="text-muted-foreground">
          Manage {title.lower()} here.
        </p>
      </div>
      
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        <p>This module is currently under development.</p>
      </div>
    </div>
  );
}}
"""
        with open(file_path, "w") as f:
            f.write(content)
            
print("Successfully generated all missing pages!")
