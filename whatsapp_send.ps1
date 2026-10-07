param(
    [string]$Contact,
    [string]$Message
)

$wshell = New-Object -ComObject WScript.Shell

# 1. Bring WhatsApp to front
Start-Process "whatsapp:"
Start-Sleep -Milliseconds 700
$wshell.AppActivate("WhatsApp")
Start-Sleep -Milliseconds 500

if ($Contact) {
    # 2. Press Ctrl+N to open "Send message to / Search" dialog (matching user's screenshot)
    $wshell.SendKeys("^n")
    Start-Sleep -Milliseconds 600

    # 3. Paste the contact name into the search box
    Set-Clipboard -Value $Contact
    $wshell.SendKeys("^v")
    Start-Sleep -Milliseconds 800

    # 4. Press Enter to select the searched contact
    $wshell.SendKeys("{ENTER}")
    Start-Sleep -Milliseconds 700
}

if ($Message) {
    # 5. Paste the message into the chat input
    Set-Clipboard -Value $Message
    $wshell.SendKeys("^v")
    Start-Sleep -Milliseconds 500

    # 6. Press Enter to send the message
    $wshell.SendKeys("{ENTER}")
}

Write-Output "SUCCESS: Dispatched to $Contact"
