import math
from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional

class DatasetAnalyticsEngine:
    @staticmethod
    def generate_synthetic_sales_history(
        products: List[Dict[str, Any]],
        as_of_date_str: Optional[str] = None,
        history_days: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Generates realistic 60-day historical sales observations for products
        lacking explicit transactional logs, preserving cyclical retail day-of-week demand patterns.
        """
        if not products:
            return []

        if as_of_date_str:
            try:
                end_dt = datetime.strptime(as_of_date_str, "%Y-%m-%d").date()
            except Exception:
                end_dt = date.today()
        else:
            end_dt = date.today()

        records = []
        # Day of week retail seasonality multipliers (Mon=0, Tue=1, ... Sun=6)
        day_multipliers = [0.90, 0.85, 0.90, 1.00, 1.30, 1.45, 1.15]

        for p in products:
            sku = p.get("sku", "").strip().upper()
            if not sku:
                continue

            lead_days = max(1, int(p.get("lead_days", 3)))
            moq = max(1, int(p.get("moq", 1)))
            pack_size = max(1, int(p.get("pack_size", 1)))
            avail_stock = max(0, int(p.get("available_stock", 0)))
            daily_d = p.get("daily_demand")

            # Determine baseline daily run-rate
            if daily_d is not None and float(daily_d) > 0:
                base_demand = float(daily_d)
            elif avail_stock > 0:
                # Realistic stock velocity (turnover every 14-35 days)
                turnover_days = max(14.0, float(lead_days * 4.0))
                base_demand = max(1.0, round(float(avail_stock) / turnover_days, 1))
            else:
                # If currently 0 stock, derive velocity from MOQ/lead time
                base_demand = max(2.0, round(float(moq) / float(lead_days), 1))

            # Deterministic hash seed based on SKU for reproducibility
            sku_hash = sum(ord(c) for c in sku)

            for d in range(history_days, 0, -1):
                cur_dt = end_dt - timedelta(days=d)
                cur_date_str = cur_dt.strftime("%Y-%m-%d")
                weekday_idx = cur_dt.weekday()

                # Multiplier and controlled variance
                mult = day_multipliers[weekday_idx]
                day_offset = (sku_hash + d * 7) % 29
                variance = 0.85 + (day_offset / 100.0)

                expected = base_demand * mult * variance
                sales_units = max(0, int(round(expected)))

                # Stockout condition for items currently out of stock (recent 3 days)
                is_stockout = False
                if avail_stock == 0 and d <= 3:
                    is_stockout = True
                    sales_units = 0

                records.append({
                    "date": cur_date_str,
                    "sku": sku,
                    "sales_units": sales_units,
                    "stockout": is_stockout,
                    "available_stock": avail_stock,
                    "lead_days": lead_days,
                    "moq": moq,
                    "pack_size": pack_size
                })

        return records

    @classmethod
    def analyze_dataset(
        cls,
        products: List[Dict[str, Any]],
        proposals: List[Any],
        sales_records: Optional[List[Dict[str, Any]]] = None,
        as_of_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Produces a rich, executive-grade analysis of an uploaded dataset:
        - Executive KPIs & Inventory Capital Valuation
        - Stockout & Critical Replenishment Reorders (MOQ/pack compliant)
        - Overstocked / Trapped Working Capital Analysis
        - Perishable & Food Spoilage Risk
        - ABC Pareto Classification
        - Prioritized Strategic AI Recommendations
        """
        if not products:
            return {
                "has_data": False,
                "total_skus": 0,
                "message": "No products currently available for analysis."
            }

        proposals_map = {p.sku: p for p in proposals}
        total_skus = len(products)
        total_units = 0
        total_cost_inr = 0.0
        total_retail_inr = 0.0
        lead_days_sum = 0
        coverage_sum = 0.0
        coverage_count = 0

        # Detailed breakdown buckets
        critical_stockouts = []
        impending_stockouts = []
        low_coverage_items = []
        overstocked_items = []
        healthy_items = []

        reorder_skus = []
        total_reorder_units = 0
        total_reorder_cost_inr = 0.0

        # Perishable tracking
        perishables = []
        expired_items = []
        spoilage_risk_items = []
        expiring_soon_items = []
        reorder_batch_items = []
        total_spoilage_units = 0
        total_spoilage_value_inr = 0.0
        total_expired_value_inr = 0.0

        for p in products:
            sku = p.get("sku", "").strip().upper()
            name = p.get("name", f"Product {sku}")
            avail = max(0, int(p.get("available_stock", 0)))
            cost = max(0.0, float(p.get("unit_cost_inr", 100.0)))
            price = max(cost, float(p.get("selling_price_inr", cost * 1.4)))
            lead = max(1, int(p.get("lead_days", 3)))
            moq = max(1, int(p.get("moq", 1)))
            pack = max(1, int(p.get("pack_size", 1)))

            total_units += avail
            total_cost_inr += (avail * cost)
            total_retail_inr += (avail * price)
            lead_days_sum += lead

            # Proposal mapping
            prop = proposals_map.get(sku)
            cov_days = getattr(prop, "coverage_days_current", None) if prop else None
            daily_fc = getattr(prop, "daily_forecast", 0.0) if prop else 0.0
            order_units = getattr(prop, "suggested_order_units", 0) if prop else 0
            arrival_date = getattr(prop, "expected_arrival_date", None) if prop else None
            risk_level = getattr(prop, "risk_level", "Unknown") if prop else "Unknown"

            if cov_days is not None:
                coverage_sum += cov_days
                coverage_count += 1

            if order_units > 0:
                reorder_cost = order_units * cost
                total_reorder_units += order_units
                total_reorder_cost_inr += reorder_cost
                reorder_skus.append({
                    "sku": sku,
                    "name": name,
                    "current_stock": avail,
                    "daily_forecast": daily_fc,
                    "lead_days": lead,
                    "suggested_order_units": order_units,
                    "reorder_cost_inr": round(reorder_cost, 2),
                    "expected_arrival_date": arrival_date,
                    "moq": moq,
                    "pack_size": pack,
                    "urgency": "High" if (avail == 0 or (cov_days is not None and cov_days < lead)) else "Normal"
                })

            # Categorize Stock Health
            if avail == 0:
                critical_stockouts.append({
                    "sku": sku,
                    "name": name,
                    "daily_forecast": daily_fc,
                    "lead_days": lead,
                    "suggested_order_units": order_units,
                    "urgency": "Immediate Stockout"
                })
            elif cov_days is not None and cov_days < lead:
                impending_stockouts.append({
                    "sku": sku,
                    "name": name,
                    "current_stock": avail,
                    "coverage_days": cov_days,
                    "lead_days": lead,
                    "suggested_order_units": order_units,
                    "expected_arrival_date": arrival_date
                })
            elif cov_days is not None and cov_days < (lead * 1.5):
                low_coverage_items.append({
                    "sku": sku,
                    "name": name,
                    "current_stock": avail,
                    "coverage_days": cov_days,
                    "lead_days": lead
                })
            elif cov_days is not None and cov_days > 45:
                # Overstocked item
                ideal_30d_units = int(daily_fc * 30) if daily_fc > 0 else avail
                excess_units = max(0, avail - ideal_30d_units)
                excess_capital = excess_units * cost
                overstocked_items.append({
                    "sku": sku,
                    "name": name,
                    "current_stock": avail,
                    "coverage_days": cov_days,
                    "daily_forecast": daily_fc,
                    "excess_units": excess_units,
                    "excess_capital_inr": round(excess_capital, 2)
                })
            else:
                healthy_items.append({
                    "sku": sku,
                    "name": name,
                    "current_stock": avail,
                    "coverage_days": cov_days
                })

            # Perishable / Expiry tracking
            is_perish = bool(p.get("is_perishable") or p.get("expiry_date"))
            if is_perish:
                exp_status = p.get("expiry_status")
                days_left = p.get("days_to_expiry")
                exp_rec = p.get("expiry_action_recommendation")
                exp_date_str = p.get("expiry_date")

                perish_entry = {
                    "sku": sku,
                    "name": name,
                    "available_stock": avail,
                    "expiry_date": exp_date_str,
                    "days_to_expiry": days_left,
                    "expiry_status": exp_status,
                    "recommendation": exp_rec,
                    "unit_cost_inr": cost
                }
                perishables.append(perish_entry)

                if exp_status == "EXPIRED":
                    loss = avail * cost
                    total_expired_value_inr += loss
                    perish_entry["loss_inr"] = round(loss, 2)
                    expired_items.append(perish_entry)
                elif exp_status == "CRITICAL_SPOILAGE":
                    spoilage_units = avail
                    if daily_fc > 0 and days_left is not None and days_left > 0:
                        expected_sales = daily_fc * days_left
                        spoilage_units = max(0, int(avail - expected_sales))
                    spoilage_val = spoilage_units * cost
                    total_spoilage_units += spoilage_units
                    total_spoilage_value_inr += spoilage_val
                    perish_entry["units_at_risk"] = spoilage_units
                    perish_entry["value_at_risk_inr"] = round(spoilage_val, 2)
                    spoilage_risk_items.append(perish_entry)
                elif exp_status == "REORDER_BATCH":
                    reorder_batch_items.append(perish_entry)
                elif exp_status == "EXPIRING_SOON":
                    expiring_soon_items.append(perish_entry)

        # High-level Metrics
        avg_lead_days = round(lead_days_sum / total_skus, 1) if total_skus > 0 else 0.0
        avg_coverage_days = round(coverage_sum / coverage_count, 1) if coverage_count > 0 else 0.0
        potential_gross_margin_inr = max(0.0, total_retail_inr - total_cost_inr)
        potential_margin_pct = round((potential_gross_margin_inr / total_retail_inr * 100), 1) if total_retail_inr > 0 else 0.0
        overstocked_capital_inr = round(sum(item["excess_capital_inr"] for item in overstocked_items), 2)

        # ABC Pareto Analysis
        # Calculate monthly velocity value per SKU: (daily_forecast * 30 * cost) or (available_stock * cost)
        sku_values = []
        for p in products:
            sku = p.get("sku", "").strip().upper()
            prop = proposals_map.get(sku)
            daily_fc = getattr(prop, "daily_forecast", 0.0) if prop else 0.0
            cost = max(0.0, float(p.get("unit_cost_inr", 100.0)))
            monthly_val = (daily_fc * 30.0 * cost) if daily_fc > 0 else (p.get("available_stock", 0) * cost)
            sku_values.append({
                "sku": sku,
                "name": p.get("name", sku),
                "monthly_value": monthly_val,
                "cost": cost,
                "stock": p.get("available_stock", 0)
            })

        sku_values.sort(key=lambda x: x["monthly_value"], reverse=True)
        total_monthly_turnover_inr = sum(s["monthly_value"] for s in sku_values)

        cum_val = 0.0
        class_a_skus, class_b_skus, class_c_skus = [], [], []
        for s in sku_values:
            cum_val += s["monthly_value"]
            pct = (cum_val / total_monthly_turnover_inr * 100.0) if total_monthly_turnover_inr > 0 else 0.0
            if pct <= 80.0 or len(class_a_skus) < max(1, int(total_skus * 0.20)):
                class_a_skus.append(s["sku"])
            elif pct <= 95.0 or len(class_b_skus) < max(1, int(total_skus * 0.30)):
                class_b_skus.append(s["sku"])
            else:
                class_c_skus.append(s["sku"])

        # Prioritized Strategic AI Recommendations
        recommendations = []

        # 1. Immediate Critical Reorders
        if reorder_skus:
            urgent_reorders = [r for r in reorder_skus if r["urgency"] == "High"]
            target_list = urgent_reorders if urgent_reorders else reorder_skus[:5]
            sku_names = ", ".join(f"{r['sku']} ({r['suggested_order_units']} u)" for r in target_list[:4])
            if len(target_list) > 4:
                sku_names += f" and {len(target_list) - 4} more"

            recommendations.append({
                "priority": "CRITICAL",
                "category": "REPLENISHMENT",
                "icon": "🚨",
                "title": f"Place Immediate Reorders for {len(reorder_skus)} SKUs",
                "action": f"Order {total_reorder_units:,} units totaling ₹{total_reorder_cost_inr:,.2f} immediately to prevent stockouts during supplier lead times.",
                "details": f"Priority items: {sku_names}. Quantities are MOQ and pack-size optimized for zero supplier friction."
            })

        # 2. Critical Stockouts
        if critical_stockouts:
            stk_names = ", ".join(s["sku"] for s in critical_stockouts[:5])
            recommendations.append({
                "priority": "CRITICAL",
                "category": "STOCKOUT",
                "icon": "❌",
                "title": f"{len(critical_stockouts)} Active Stockout Outages Detected",
                "action": f"Expedite urgent replenishment for {stk_names}. Currently 0 units available on shelves, causing immediate revenue loss.",
                "details": "Initiate emergency PO with supplier or reallocate stock from adjacent fulfillment locations."
            })

        # 3. Impending Stockouts (Shortfall before arrival)
        if impending_stockouts:
            imp_names = ", ".join(f"{s['sku']} ({s['coverage_days']}d coverage vs {s['lead_days']}d lead)" for s in impending_stockouts[:3])
            recommendations.append({
                "priority": "HIGH",
                "category": "BUFFER_DEFICIT",
                "icon": "⚠️",
                "title": f"{len(impending_stockouts)} SKUs Will Stock Out Before Supplier Delivery",
                "action": f"Current stock runs out faster than supplier delivery time for: {imp_names}.",
                "details": "Issue PO immediately and consider express freight to compress lead times."
            })

        # 4. Perishable Spoilage Risk
        if spoilage_risk_items:
            spoil_names = ", ".join(s["sku"] for s in spoilage_risk_items[:3])
            recommendations.append({
                "priority": "HIGH",
                "category": "PERISHABLE_SPOILAGE",
                "icon": "⚡",
                "title": f"Prevent Spoilage on {len(spoilage_risk_items)} Perishable Products",
                "action": f"Run a 20%–35% promotional discount on {spoil_names} to sell {total_spoilage_units} units before expiry dates.",
                "details": f"Protects ₹{total_spoilage_value_inr:,.2f} in at-risk inventory value from turning into a total loss."
            })

        if expired_items:
            exp_names = ", ".join(s["sku"] for s in expired_items[:3])
            recommendations.append({
                "priority": "CRITICAL",
                "category": "FOOD_SAFETY",
                "icon": "⛔",
                "title": f"Remove {len(expired_items)} Expired Products Immediately",
                "action": f"Quarantine and safely discard expired lots for {exp_names}.",
                "details": f"Compliance alert: ₹{total_expired_value_inr:,.2f} of expired stock must not be sold to retail consumers."
            })

        if reorder_batch_items:
            batch_names = ", ".join(s["sku"] for s in reorder_batch_items[:3])
            recommendations.append({
                "priority": "MEDIUM",
                "category": "BATCH_ROTATION",
                "icon": "🔄",
                "title": f"Reorder Fresh Production Batch for {len(reorder_batch_items)} Perishables",
                "action": f"Order fresh lot runs for {batch_names} as current batch approaches lead-time shelf-life threshold.",
                "details": "Ensures uninterrupted fresh supply on shelves without stock gap."
            })

        # 5. Overstocked Working Capital Traps
        if overstocked_items:
            over_names = ", ".join(f"{s['sku']} ({s['coverage_days']}d)" for s in overstocked_items[:3])
            recommendations.append({
                "priority": "MEDIUM",
                "category": "WORKING_CAPITAL",
                "icon": "📦",
                "title": f"Liberate ₹{overstocked_capital_inr:,.2f} from {len(overstocked_items)} Overstocked SKUs",
                "action": f"Pause procurement on items exceeding 45 days coverage ({over_names}).",
                "details": "Redirect tied-up liquidity toward fast-moving Class-A items with tight lead times."
            })

        # 6. ABC Pareto Strategy
        if class_a_skus:
            recommendations.append({
                "priority": "LOW",
                "category": "ABC_MANAGEMENT",
                "icon": "⭐",
                "title": f"Prioritize Service Level on Top {len(class_a_skus)} Class-A SKUs",
                "action": f"Maintain 98%+ on-shelf availability for high-velocity drivers ({', '.join(class_a_skus[:4])}).",
                "details": "Class-A SKUs generate 80% of your business throughput. Implement weekly cycle counts and proactive reorder alerts."
            })

        return {
            "has_data": True,
            "as_of_date": as_of_date or datetime.now().strftime("%Y-%m-%d"),
            "executive_summary": {
                "total_skus": total_skus,
                "total_units_on_hand": total_units,
                "total_cost_value_inr": round(total_cost_inr, 2),
                "total_retail_value_inr": round(total_retail_inr, 2),
                "potential_gross_margin_inr": round(potential_gross_margin_inr, 2),
                "potential_margin_pct": potential_margin_pct,
                "average_lead_days": avg_lead_days,
                "average_coverage_days": avg_coverage_days
            },
            "reorder_action_summary": {
                "skus_needing_reorder": len(reorder_skus),
                "total_suggested_order_units": total_reorder_units,
                "total_reorder_cost_inr": round(total_reorder_cost_inr, 2),
                "reorder_items": reorder_skus[:25],
                "critical_stockouts": critical_stockouts,
                "impending_stockouts": impending_stockouts,
                "low_coverage_count": len(low_coverage_items)
            },
            "overstock_summary": {
                "overstocked_skus_count": len(overstocked_items),
                "capital_tied_up_inr": overstocked_capital_inr,
                "overstocked_items": overstocked_items[:15]
            },
            "perishable_summary": {
                "perishable_skus_count": len(perishables),
                "expired_count": len(expired_items),
                "expired_loss_inr": round(total_expired_value_inr, 2),
                "spoilage_risk_count": len(spoilage_risk_items),
                "spoilage_units_at_risk": total_spoilage_units,
                "spoilage_value_at_risk_inr": round(total_spoilage_value_inr, 2),
                "expiring_soon_count": len(expiring_soon_items),
                "reorder_batch_count": len(reorder_batch_items),
                "perishable_items": perishables[:20]
            },
            "abc_classification": {
                "class_a": {
                    "count": len(class_a_skus),
                    "pct": round(len(class_a_skus) / total_skus * 100, 1),
                    "skus": class_a_skus,
                    "strategy": "High priority: Strict daily inventory tracking and safety stock buffers."
                },
                "class_b": {
                    "count": len(class_b_skus),
                    "pct": round(len(class_b_skus) / total_skus * 100, 1),
                    "skus": class_b_skus,
                    "strategy": "Moderate priority: Weekly review and standard replenishment."
                },
                "class_c": {
                    "count": len(class_c_skus),
                    "pct": round(len(class_c_skus) / total_skus * 100, 1),
                    "skus": class_c_skus,
                    "strategy": "Low priority: Bulk ordering, higher MOQ thresholds, minimal reviews."
                }
            },
            "actionable_recommendations": recommendations
        }
