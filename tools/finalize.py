import zipfile, sys
src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src); zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    data = zin.read(it.filename)
    if it.filename == 'xl/workbook.xml':
        t = data.decode('utf8')
        if 'fullCalcOnLoad' not in t: t = t.replace('<calcPr ', '<calcPr fullCalcOnLoad="1" ', 1)
        data = t.encode('utf8')
    zout.writestr(it, data)
zout.close()
