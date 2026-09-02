; NSIS Installer Hooks for PaperLite PDF Reader
; Ensures pdf-icon.ico is registered in Windows Registry as DefaultIcon for .pdf files

!macro NSIS_HOOK_POSTINSTALL
  ; Register PDF document file type with custom pdf-icon.ico in Windows Registry
  WriteRegStr HKCR ".pdf" "" "PaperLite.PDF"
  WriteRegStr HKCR ".pdf" "Content Type" "application/pdf"
  WriteRegStr HKCR ".pdf" "PerceivedType" "document"
  
  WriteRegStr HKCR "PaperLite.PDF" "" "PDF Document"
  WriteRegStr HKCR "PaperLite.PDF\DefaultIcon" "" "$INSTDIR\icons\pdf-icon.ico,0"
  WriteRegStr HKCR "PaperLite.PDF\shell" "" "open"
  WriteRegStr HKCR "PaperLite.PDF\shell\open" "FriendlyAppName" "PaperLite PDF Reader"
  WriteRegStr HKCR "PaperLite.PDF\shell\open\command" "" '"$INSTDIR\PaperLite PDF Reader.exe" "%1"'

  ; Register in Current User classes for non-admin permission contexts
  WriteRegStr HKCU "Software\Classes\.pdf" "" "PaperLite.PDF"
  WriteRegStr HKCU "Software\Classes\.pdf" "Content Type" "application/pdf"
  WriteRegStr HKCU "Software\Classes\.pdf" "PerceivedType" "document"
  
  WriteRegStr HKCU "Software\Classes\PaperLite.PDF" "" "PDF Document"
  WriteRegStr HKCU "Software\Classes\PaperLite.PDF\DefaultIcon" "" "$INSTDIR\icons\pdf-icon.ico,0"
  WriteRegStr HKCU "Software\Classes\PaperLite.PDF\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\PaperLite.PDF\shell\open" "FriendlyAppName" "PaperLite PDF Reader"
  WriteRegStr HKCU "Software\Classes\PaperLite.PDF\shell\open\command" "" '"$INSTDIR\PaperLite PDF Reader.exe" "%1"'

  ; Refresh Windows Explorer Shell Icon Cache
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCR "PaperLite.PDF"
  DeleteRegKey HKCU "Software\Classes\PaperLite.PDF"
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
