import sys, openpyxl
src, out = sys.argv[1], sys.argv[2]
vals = dict(a.split('=',1) for a in sys.argv[3:])
wb = openpyxl.load_workbook(src)
for k, v in vals.items():
    dn = wb.defined_names[k]
    sh, ref = list(dn.destinations)[0]
    try: v = float(v)
    except ValueError: v = None if v == '' else v
    wb[sh][ref.replace('$','')] = v
wb.save(out)
