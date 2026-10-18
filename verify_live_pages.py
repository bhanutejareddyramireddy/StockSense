import httpx

pages = [
    "/",
    "/index.html",
    "/dashboard.html",
    "/inventory.html",
    "/sales.html",
    "/forecasting.html",
    "/replenishment.html",
    "/scenarios.html",
    "/evaluation.html",
    "/reports.html",
    "/business-plan.html",
    "/settings.html",
    "/api/health",
    "/api/dataset/summary",
    "/api/dataset/products",
    "/api/forecast/all",
    "/api/evaluation/summary",
    "/api/replenishment/proposals",
    "/api/replenishment/verify-benchmarks",
    "/api/business/overview"
]

client = httpx.Client(base_url="http://127.0.0.1:8000")
all_passed = True

print("Verifying all HTML pages and API endpoints on live server:")
for p in pages:
    try:
        res = client.get(p)
        status = res.status_code
        ok = (status == 200)
        if not ok:
            all_passed = False
        print(f"  {p:<35} -> HTTP {status} {'[OK]' if ok else '[FAILED]'}")
    except Exception as e:
        all_passed = False
        print(f"  {p:<35} -> Error: {str(e)}")

print("\nAll endpoints and pages live test:", "PASSED" if all_passed else "FAILED")
