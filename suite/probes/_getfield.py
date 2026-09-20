import sys, frappe
frappe.init(site=sys.argv[1]); frappe.connect()
print(frappe.db.get_value(sys.argv[2], sys.argv[3], sys.argv[4]))
