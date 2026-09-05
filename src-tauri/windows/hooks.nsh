; NSIS Installer Hooks for PaperLite PDF Reader
; Ensures pdf-icon.ico is copied to install dir and registered in Windows Registry as DefaultIcon for .pdf files

!macro NSIS_HOOK_POSTINSTALL
  ; Ensure icons directory exists in $INSTDIR
  CreateDirectory "$INSTDIR\icons"

  ; Ensure pdf-icon.ico exists in $INSTDIR\icons\ and $INSTDIR\
  IfFileExists "$INSTDIR\resources\icons\pdf-icon.ico" 0 +4
    CopyFiles /SILENT "$INSTDIR\resources\icons\pdf-icon.ico" "$INSTDIR\icons\pdf-icon.ico"
    CopyFiles /SILENT "$INSTDIR\resources\icons\pdf-icon.ico" "$INSTDIR\pdf-icon.ico"
    Goto copy_done
  IfFileExists "$INSTDIR\resources\pdf-icon.ico" 0 +4
    CopyFiles /SILENT "$INSTDIR\resources\pdf-icon.ico" "$INSTDIR\icons\pdf-icon.ico"
    CopyFiles /SILENT "$INSTDIR\resources\pdf-icon.ico" "$INSTDIR\pdf-icon.ico"
    Goto copy_done
  IfFileExists "$INSTDIR\icons\pdf-icon.ico" 0 +3
    CopyFiles /SILENT "$INSTDIR\icons\pdf-icon.ico" "$INSTDIR\pdf-icon.ico"
    Goto copy_done
  IfFileExists "$INSTDIR\pdf-icon.ico" 0 +3
    CopyFiles /SILENT "$INSTDIR\pdf-icon.ico" "$INSTDIR\icons\pdf-icon.ico"
    Goto copy_done
copy_done:

  ; 1. Register PaperLite.PDF ProgID with quoted pdf-icon.ico in HKCR
  WriteRegStr HKCR ".pdf" "" "PaperLite.PDF"
  WriteRegStr HKCR ".pdf" "Content Type" "application/pdf"
  WriteRegStr HKCR ".pdf" "PerceivedType" "document"
  WriteRegStr HKCR ".pdf\DefaultIcon" "" '"$INSTDIR\icons\pdf-icon.ico"'
  WriteRegStr HKCR ".pdf\OpenWithProgids" "PaperLite.PDF" ""
  WriteRegStr HKCR ".pdf\OpenWithProgids" "com.paperlite.pdfreader.pdf" ""
  
  WriteRegStr HKCR "SystemFileAssociations\.pdf\DefaultIcon" "" '"$INSTDIR\icons\pdf-icon.ico"'

  WriteRegStr HKCR "PaperLite.PDF" "" "PDF Document"
  WriteRegStr HKCR "PaperLite.PDF\DefaultIcon" "" '"$INSTDIR\icons\pdf-icon.ico"'
  WriteRegStr HKCR "PaperLite.PDF\shell" "" "open"
  WriteRegStr HKCR "PaperLite.PDF\shell\open" "FriendlyAppName" "PaperLite PDF Reader"
  WriteRegStr HKCR "PaperLite.PDF\shell\open\command" "" '"$INSTDIR\PaperLite PDF Reader.exe" "%1"'

  ; 2. Override Tauri default bundle ID ProgID (com.paperlite.pdfreader.pdf) DefaultIcon
  ; By default Tauri sets this to "$INSTDIR\PaperLite PDF Reader.exe,0" which is icon.ico.
  ; We redirect it directly to quoted pdf-icon.ico!
  WriteRegStr HKCR "com.paperlite.pdfreader.pdf" "" "PDF Document"
  WriteRegStr HKCR "com.paperlite.pdfreader.pdf\DefaultIcon" "" '"$INSTDIR\icons\pdf-icon.ico"'
  WriteRegStr HKCR "com.paperlite.pdfreader.pdf\shell" "" "open"
  WriteRegStr HKCR "com.paperlite.pdfreader.pdf\shell\open" "FriendlyAppName" "PaperLite PDF Reader"
  WriteRegStr HKCR "com.paperlite.pdfreader.pdf\shell\open\command" "" '"$INSTDIR\PaperLite PDF Reader.exe" "%1"'

  ; 3. Register in Current User classes (HKCU) for user-level installations & permissions
  WriteRegStr HKCU "Software\Classes\.pdf" "" "PaperLite.PDF"
  WriteRegStr HKCU "Software\Classes\.pdf" "Content Type" "application/pdf"
  WriteRegStr HKCU "Software\Classes\.pdf" "PerceivedType" "document"
  WriteRegStr HKCU "Software\Classes\.pdf\DefaultIcon" "" '"$INSTDIR\icons\pdf-icon.ico"'
  WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "PaperLite.PDF" ""
  WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "com.paperlite.pdfreader.pdf" ""
  
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\DefaultIcon" "" '"$INSTDIR\icons\pdf-icon.ico"'

  WriteRegStr HKCU "Software\Classes\PaperLite.PDF" "" "PDF Document"
  WriteRegStr HKCU "Software\Classes\PaperLite.PDF\DefaultIcon" "" '"$INSTDIR\icons\pdf-icon.ico"'
  WriteRegStr HKCU "Software\Classes\PaperLite.PDF\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\PaperLite.PDF\shell\open" "FriendlyAppName" "PaperLite PDF Reader"
  WriteRegStr HKCU "Software\Classes\PaperLite.PDF\shell\open\command" "" '"$INSTDIR\PaperLite PDF Reader.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\com.paperlite.pdfreader.pdf" "" "PDF Document"
  WriteRegStr HKCU "Software\Classes\com.paperlite.pdfreader.pdf\DefaultIcon" "" '"$INSTDIR\icons\pdf-icon.ico"'
  WriteRegStr HKCU "Software\Classes\com.paperlite.pdfreader.pdf\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\com.paperlite.pdfreader.pdf\shell\open" "FriendlyAppName" "PaperLite PDF Reader"
  WriteRegStr HKCU "Software\Classes\com.paperlite.pdfreader.pdf\shell\open\command" "" '"$INSTDIR\PaperLite PDF Reader.exe" "%1"'

  ; 4. Register Applications entry DefaultIcon
  WriteRegStr HKCU "Software\Classes\Applications\PaperLite PDF Reader.exe\SupportedTypes" ".pdf" ""
  WriteRegStr HKCU "Software\Classes\Applications\PaperLite PDF Reader.exe\DefaultIcon" "" '"$INSTDIR\icons\pdf-icon.ico"'
  WriteRegStr HKCR "Applications\PaperLite PDF Reader.exe\SupportedTypes" ".pdf" ""
  WriteRegStr HKCR "Applications\PaperLite PDF Reader.exe\DefaultIcon" "" '"$INSTDIR\icons\pdf-icon.ico"'

  ; 5. Flush and refresh Windows File Explorer Shell Icon Cache
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0x1000, i 0, i 0)'
  ExecWait 'ie4uinit.exe -show'
  ExecWait 'ie4uinit.exe -ClearIconCache'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCR "PaperLite.PDF"
  DeleteRegKey HKCR "com.paperlite.pdfreader.pdf"
  DeleteRegKey HKCU "Software\Classes\PaperLite.PDF"
  DeleteRegKey HKCU "Software\Classes\com.paperlite.pdfreader.pdf"
  DeleteRegKey HKCU "Software\Classes\Applications\PaperLite PDF Reader.exe"
  DeleteRegKey HKCR "Applications\PaperLite PDF Reader.exe"
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0x1000, i 0, i 0)'
  ExecWait 'ie4uinit.exe -show'
  ExecWait 'ie4uinit.exe -ClearIconCache'
!macroend
