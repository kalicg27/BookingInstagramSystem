{
  "name": "AI Chatbot Calendar Booking System",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "chat",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "chat-webhook",
      "name": "Chat Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1.1,
      "position": [250, 400],
      "webhookId": "chat-booking"
    },
    {
      "parameters": {
        "functionCode": "// Extract message and session data\nconst body = $input.item.json.body;\n\nreturn {\n  json: {\n    message: body.message,\n    sessionId: body.sessionId || `session_${Date.now()}`,\n    conversationHistory: body.conversationHistory || []\n  }\n};"
      },
      "id": "parse-message",
      "name": "Parse User Message",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [450, 400]
    },
    {
      "parameters": {
        "mode": "raw",
        "jsonOutput": "={{ JSON.stringify({\n  sessionId: $json.sessionId,\n  userMessage: $json.message,\n  conversationHistory: $json.conversationHistory\n}) }}",
        "options": {}
      },
      "id": "store-context",
      "name": "Store Context",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [650, 400]
    },
    {
      "parameters": {
        "operation": "getAll",
        "calendar": "primary",
        "start": "={{ new Date().toISOString().split('T')[0] }}T00:00:00",
        "end": "={{ new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0] }}T23:59:59",
        "options": {
          "timeZone": "UTC"
        }
      },
      "id": "get-calendar-events",
      "name": "Get Calendar Events",
      "type": "n8n-nodes-base.googleCalendar",
      "typeVersion": 1.2,
      "position": [850, 400],
      "credentials": {
        "googleCalendarOAuth2Api": {
          "id": "1",
          "name": "Google Calendar account"
        }
      }
    },
    {
      "parameters": {
        "functionCode": "// Calculate available slots for next 14 days\nconst events = $input.all();\nconst today = new Date();\nconst availabilityMap = {};\n\n// Business hours: 9 AM to 5 PM, 30-min slots\nconst startHour = 9;\nconst endHour = 17;\nconst slotDuration = 30;\n\n// Generate slots for next 14 days\nfor (let dayOffset = 0; dayOffset < 14; dayOffset++) {\n  const date = new Date(today);\n  date.setDate(today.getDate() + dayOffset);\n  const dateStr = date.toISOString().split('T')[0];\n  \n  // Skip weekends\n  if (date.getDay() === 0 || date.getDay() === 6) continue;\n  \n  availabilityMap[dateStr] = [];\n  \n  for (let hour = startHour; hour < endHour; hour++) {\n    for (let minute = 0; minute < 60; minute += slotDuration) {\n      const slotStart = new Date(date);\n      slotStart.setHours(hour, minute, 0, 0);\n      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);\n      \n      if (slotEnd.getHours() >= endHour) continue;\n      \n      // Check for conflicts\n      let hasConflict = false;\n      for (const event of events) {\n        const eventStart = new Date(event.json.start.dateTime || event.json.start.date);\n        const eventEnd = new Date(event.json.end.dateTime || event.json.end.date);\n        \n        if (slotStart < eventEnd && slotEnd > eventStart) {\n          hasConflict = true;\n          break;\n        }\n      }\n      \n      if (!hasConflict) {\n        availabilityMap[dateStr].push({\n          time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,\n          datetime: slotStart.toISOString()\n        });\n      }\n    }\n  }\n}\n\nconst context = $('Store Context').item.json;\n\nreturn {\n  json: {\n    ...context,\n    availableSlots: availabilityMap,\n    currentDate: today.toISOString().split('T')[0]\n  }\n};"
      },
      "id": "calculate-availability",
      "name": "Calculate Available Slots",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1050, 400]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://localhost:11434/api/chat",
        "authentication": "none",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "model",
              "value": "llama3.2"
            },
            {
              "name": "messages",
              "value": "={{ JSON.stringify([\n  {\n    role: 'system',\n    content: `You are a friendly AI booking assistant. Your job is to help users book appointments in a natural, conversational way.\n\nYour capabilities:\n- You can check available time slots\n- You can book appointments when you have all required information\n- You guide users naturally through the booking process\n\nRequired information to book:\n1. Full name\n2. Email address\n3. Phone number (optional)\n4. Preferred date\n5. Preferred time\n6. Type of service/reason for appointment\n\nCurrent date: ${$json.currentDate}\n\nAvailable slots (next 14 days, weekdays only, 9 AM - 5 PM):\n${JSON.stringify($json.availableSlots, null, 2)}\n\nRules:\n- Be conversational and friendly\n- Ask for one piece of information at a time\n- Validate that requested times are available\n- Suggest alternative times if requested slot is unavailable\n- Confirm all details before booking\n- If user asks about availability, show available slots for their preferred date\n- Use natural language to describe times (e.g., \"morning\", \"afternoon\")\n\nWhen you have all required information and user confirms, respond with JSON in this EXACT format:\n{\n  \"action\": \"book_appointment\",\n  \"data\": {\n    \"name\": \"user name\",\n    \"email\": \"user@example.com\",\n    \"phone\": \"phone number\",\n    \"date\": \"YYYY-MM-DD\",\n    \"time\": \"HH:MM\",\n    \"service\": \"service description\"\n  }\n}\n\nIf just chatting or gathering info, respond normally without JSON.`\n  },\n  ...($json.conversationHistory || []),\n  {\n    role: 'user',\n    content: $json.userMessage\n  }\n]) }}"
            },
            {
              "name": "stream",
              "value": "false"
            },
            {
              "name": "options",
              "value": "={{ JSON.stringify({ temperature: 0.7, top_p: 0.9 }) }}"
            }
          ]
        },
        "options": {
          "timeout": 30000
        }
      },
      "id": "ollama-chat",
      "name": "Ollama AI Chat",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1250, 400]
    },
    {
      "parameters": {
        "functionCode": "// Parse Ollama response\nconst response = $input.item.json;\nconst aiMessage = response.message.content;\nconst context = $('Calculate Available Slots').item.json;\n\n// Check if AI wants to book appointment\nlet bookingData = null;\ntry {\n  // Look for JSON in the response\n  const jsonMatch = aiMessage.match(/\\{[\\s\\S]*\"action\"[\\s\\S]*\\}/);\n  if (jsonMatch) {\n    bookingData = JSON.parse(jsonMatch[0]);\n  }\n} catch (e) {\n  // Not a booking action, just chatting\n}\n\n// Update conversation history\nconst conversationHistory = [\n  ...(context.conversationHistory || []),\n  { role: 'user', content: context.userMessage },\n  { role: 'assistant', content: aiMessage }\n];\n\n// Keep only last 10 messages to avoid context overflow\nif (conversationHistory.length > 10) {\n  conversationHistory.splice(0, conversationHistory.length - 10);\n}\n\nreturn {\n  json: {\n    sessionId: context.sessionId,\n    aiResponse: aiMessage,\n    conversationHistory,\n    bookingData,\n    shouldBook: bookingData && bookingData.action === 'book_appointment'\n  }\n};"
      },
      "id": "parse-ai-response",
      "name": "Parse AI Response",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1450, 400]
    },
    {
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.shouldBook }}",
              "value2": true
            }
          ]
        }
      },
      "id": "check-booking-intent",
      "name": "Should Book?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [1650, 400]
    },
    {
      "parameters": {
        "operation": "create",
        "calendar": "primary",
        "start": "={{ $json.bookingData.data.date }}T{{ $json.bookingData.data.time }}:00",
        "end": "={{ new Date(new Date($json.bookingData.data.date + 'T' + $json.bookingData.data.time + ':00').getTime() + 60*60000).toISOString() }}",
        "summary": "={{ $json.bookingData.data.service }} - {{ $json.bookingData.data.name }}",
        "description": "Booked via AI Assistant\\n\\nClient Information:\\nName: {{ $json.bookingData.data.name }}\\nEmail: {{ $json.bookingData.data.email }}\\nPhone: {{ $json.bookingData.data.phone }}\\nService: {{ $json.bookingData.data.service }}",
        "additionalFields": {
          "attendees": [
            {
              "email": "={{ $json.bookingData.data.email }}",
              "displayName": "={{ $json.bookingData.data.name }}"
            }
          ],
          "reminders": {
            "useDefault": false,
            "overrides": [
              {
                "method": "email",
                "minutes": 1440
              },
              {
                "method": "popup",
                "minutes": 30
              }
            ]
          }
        },
        "options": {
          "sendUpdates": "all"
        }
      },
      "id": "create-booking",
      "name": "Create Calendar Event",
      "type": "n8n-nodes-base.googleCalendar",
      "typeVersion": 1.2,
      "position": [1850, 300],
      "credentials": {
        "googleCalendarOAuth2Api": {
          "id": "1",
          "name": "Google Calendar account"
        }
      }
    },
    {
      "parameters": {
        "functionCode": "const event = $input.item.json;\nconst parseNode = $('Parse AI Response').item.json;\n\nreturn {\n  json: {\n    sessionId: parseNode.sessionId,\n    message: `✅ Perfect! Your appointment has been booked successfully!\\n\\n📅 **Booking Confirmation**\\nDate: ${parseNode.bookingData.data.date}\\nTime: ${parseNode.bookingData.data.time}\\nService: ${parseNode.bookingData.data.service}\\n\\nA confirmation email has been sent to ${parseNode.bookingData.data.email}. You'll also receive a calendar invitation.\\n\\nSee you then! 😊`,\n    conversationHistory: parseNode.conversationHistory,\n    eventId: event.id,\n    eventLink: event.htmlLink,\n    booked: true\n  }\n};"
      },
      "id": "format-booking-success",
      "name": "Format Booking Success",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [2050, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($json, null, 2) }}",
        "options": {
          "responseCode": 200
        }
      },
      "id": "booking-response",
      "name": "Send Booking Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [2250, 300]
    },
    {
      "parameters": {
        "functionCode": "const parseNode = $input.item.json;\n\nreturn {\n  json: {\n    sessionId: parseNode.sessionId,\n    message: parseNode.aiResponse,\n    conversationHistory: parseNode.conversationHistory,\n    booked: false\n  }\n};"
      },
      "id": "format-chat-response",
      "name": "Format Chat Response",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1850, 500]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($json, null, 2) }}",
        "options": {
          "responseCode": 200
        }
      },
      "id": "chat-response",
      "name": "Send Chat Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [2050, 500]
    },
    {
      "parameters": {
        "fromEmail": "noreply@yourdomain.com",
        "toEmail": "={{ $('Parse AI Response').item.json.bookingData.data.email }}",
        "subject": "Appointment Confirmation - {{ $('Parse AI Response').item.json.bookingData.data.date }}",
        "emailType": "html",
        "message": "=<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">\n  <h2 style=\"color: #2563eb;\">🎉 Your Appointment is Confirmed!</h2>\n  \n  <p>Hi {{ $('Parse AI Response').item.json.bookingData.data.name }},</p>\n  \n  <p>Your appointment has been successfully booked. Here are the details:</p>\n  \n  <div style=\"background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;\">\n    <p style=\"margin: 5px 0;\"><strong>📅 Date:</strong> {{ $('Parse AI Response').item.json.bookingData.data.date }}</p>\n    <p style=\"margin: 5px 0;\"><strong>🕐 Time:</strong> {{ $('Parse AI Response').item.json.bookingData.data.time }}</p>\n    <p style=\"margin: 5px 0;\"><strong>🔧 Service:</strong> {{ $('Parse AI Response').item.json.bookingData.data.service }}</p>\n    <p style=\"margin: 5px 0;\"><strong>📧 Email:</strong> {{ $('Parse AI Response').item.json.bookingData.data.email }}</p>\n    <p style=\"margin: 5px 0;\"><strong>📱 Phone:</strong> {{ $('Parse AI Response').item.json.bookingData.data.phone }}</p>\n  </div>\n  \n  <p>A calendar invitation has been sent to your email. Please add it to your calendar.</p>\n  \n  <p><a href=\"{{ $json.htmlLink }}\" style=\"background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0;\">View in Google Calendar</a></p>\n  \n  <p style=\"color: #6b7280; font-size: 14px; margin-top: 30px;\">If you need to reschedule or cancel, please contact us as soon as possible.</p>\n  \n  <p>Looking forward to seeing you!</p>\n</div>",
        "options": {}
      },
      "id": "send-confirmation-email",
      "name": "Send Confirmation Email",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 2.1,
      "position": [2050, 150],
      "credentials": {
        "smtp": {
          "id": "2",
          "name": "SMTP account"
        }
      }
    }
  ],
  "connections": {
    "Chat Webhook": {
      "main": [
        [
          {
            "node": "Parse User Message",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Parse User Message": {
      "main": [
        [
          {
            "node": "Store Context",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Store Context": {
      "main": [
        [
          {
            "node": "Get Calendar Events",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get Calendar Events": {
      "main": [
        [
          {
            "node": "Calculate Available Slots",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Calculate Available Slots": {
      "main": [
        [
          {
            "node": "Ollama AI Chat",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Ollama AI Chat": {
      "main": [
        [
          {
            "node": "Parse AI Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Parse AI Response": {
      "main": [
        [
          {
            "node": "Should Book?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Should Book?": {
      "main": [
        [
          {
            "node": "Create Calendar Event",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Format Chat Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Create Calendar Event": {
      "main": [
        [
          {
            "node": "Format Booking Success",
            "type": "main",
            "index": 0
          },
          {
            "node": "Send Confirmation Email",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Format Booking Success": {
      "main": [
        [
          {
            "node": "Send Booking Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Format Chat Response": {
      "main": [
        [
          {
            "node": "Send Chat Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {},
  "settings": {
    "executionOrder": "v1"
  },
  "staticData": null,
  "tags": [],
  "triggerCount": 0,
  "updatedAt": "2025-10-09T12:00:00.000Z",
  "versionId": "2"
}