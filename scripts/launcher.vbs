Dim fso, currentDir, projectDir
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(currentDir)

Dim shell
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = projectDir

Dim command
command = "node """ & projectDir & "\scripts\launcher.mjs"""

shell.Run command, 0, False
