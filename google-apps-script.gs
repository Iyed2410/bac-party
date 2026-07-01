const SPREADSHEET_ID = ""; // Paste the Iyed Bac Party Responses spreadsheet ID here.
const ADMIN_TOKEN = "CHANGE_ME_FOR_IYED";

const SHEET_NAMES = {
  rsvp: "RSVP",
  music: "Music Votes",
  memory: "Memory Wall",
  guest: "Guest List",
};

const HEADERS = {
  [SHEET_NAMES.rsvp]: [
    "Timestamp",
    "Full Name",
    "Attendance Status",
    "Number of Guests",
    "Message to Iyed",
  ],
  [SHEET_NAMES.music]: [
    "Timestamp",
    "Full Name",
    "Selected Genres",
    "Suggested Songs",
  ],
  [SHEET_NAMES.memory]: [
    "Timestamp",
    "Full Name",
    "Memory Message",
    "Funny Roast",
    "Approved",
  ],
  [SHEET_NAMES.guest]: [
    "Timestamp",
    "Full Name",
    "Attendance Status",
    "Number of Guests",
    "Public Display Name",
  ],
};

const COMING_STATUSES = ["I’m coming 🔥", "I'm coming 🔥", "Maybe 👀"];

function doPost(event) {
  try {
    setupSheets();
    const payload = parsePayload_(event);

    if (!payload.type) {
      throw new Error("Missing form type.");
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      switch (payload.type) {
        case "rsvp":
          saveRsvp_(payload);
          break;
        case "music":
          saveMusic_(payload);
          break;
        case "memory":
          saveMemory_(payload);
          break;
        default:
          throw new Error("Unknown form type.");
      }
    } finally {
      lock.releaseLock();
    }

    return json_({ success: true });
  } catch (error) {
    return json_({ success: false, error: error.message });
  }
}

function doGet(event) {
  try {
    setupSheets();
    const action = event.parameter.action || "public";

    if (action === "admin") {
      if (event.parameter.token !== ADMIN_TOKEN) {
        throw new Error("Invalid admin token.");
      }
      return json_(getAdminData_());
    }

    return json_(getPublicData_());
  } catch (error) {
    return json_({ success: false, error: error.message });
  }
}

function setupSheets() {
  const spreadsheet = getSpreadsheet_();

  Object.keys(HEADERS).forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    const headers = HEADERS[sheetName];
    const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const needsHeaders = headers.some((header, index) => currentHeaders[index] !== header);

    if (needsHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, headers.length);
    }
  });
}

function saveRsvp_(payload) {
  const fullName = required_(payload.fullName, "Full name is required.");
  const attendanceStatus = required_(payload.attendanceStatus, "Attendance status is required.");
  const guestCount = payload.guestCount === "" || payload.guestCount == null ? "0" : String(payload.guestCount);
  const message = clean_(payload.message);
  const timestamp = new Date();

  upsertByName_(SHEET_NAMES.rsvp, fullName, [
    timestamp,
    fullName,
    attendanceStatus,
    guestCount,
    message,
  ]);

  if (COMING_STATUSES.indexOf(attendanceStatus) !== -1) {
    const publicDisplayName = clean_(payload.publicDisplayName) || firstName_(fullName);
    upsertByName_(SHEET_NAMES.guest, fullName, [
      timestamp,
      fullName,
      attendanceStatus,
      guestCount,
      publicDisplayName,
    ]);
  } else {
    deleteByName_(SHEET_NAMES.guest, fullName);
  }
}

function saveMusic_(payload) {
  const fullName = required_(payload.fullName, "Full name is required.");
  const genres = Array.isArray(payload.genres) ? payload.genres.map(clean_).filter(Boolean) : [];
  const suggestedSongs = clean_(payload.suggestedSongs);

  if (!genres.length && !suggestedSongs) {
    throw new Error("Choose at least one genre or suggest a song.");
  }

  getSheet_(SHEET_NAMES.music).appendRow([
    new Date(),
    fullName,
    genres.join(", "),
    suggestedSongs,
  ]);
}

function saveMemory_(payload) {
  const fullName = required_(payload.fullName, "Full name is required.");
  const memoryMessage = required_(payload.memoryMessage, "Memory message is required.");
  const funnyRoast = clean_(payload.funnyRoast);

  getSheet_(SHEET_NAMES.memory).appendRow([
    new Date(),
    fullName,
    memoryMessage,
    funnyRoast,
    "No",
  ]);
}

function getPublicData_() {
  return {
    success: true,
    guestList: readRows_(SHEET_NAMES.guest)
      .filter((row) => COMING_STATUSES.indexOf(row.attendanceStatus) !== -1)
      .map((row) => ({
        fullName: row.fullName,
        attendanceStatus: row.attendanceStatus,
        guestCount: row.numberOfGuests,
        publicDisplayName: row.publicDisplayName || firstName_(row.fullName),
      })),
    memories: readRows_(SHEET_NAMES.memory)
      .filter((row) => String(row.approved || "").toLowerCase() === "yes")
      .map((row) => ({
        fullName: row.fullName,
        publicDisplayName: firstName_(row.fullName),
        memoryMessage: row.memoryMessage,
        funnyRoast: row.funnyRoast,
      })),
  };
}

function getAdminData_() {
  const rsvps = readRows_(SHEET_NAMES.rsvp);
  const musicRows = readRows_(SHEET_NAMES.music);
  const memories = readRows_(SHEET_NAMES.memory);
  const guestList = readRows_(SHEET_NAMES.guest);
  const stats = {
    totalRsvp: rsvps.length,
    coming: rsvps.filter((row) => COMING_STATUSES.indexOf(row.attendanceStatus) !== -1 && row.attendanceStatus !== "Maybe 👀").length,
    maybe: rsvps.filter((row) => row.attendanceStatus === "Maybe 👀").length,
    notComing: rsvps.filter((row) => row.attendanceStatus === "I can’t 😭" || row.attendanceStatus === "I can't 😭").length,
  };
  const genreCounts = {};
  const suggestedSongs = [];

  musicRows.forEach((row) => {
    String(row.selectedGenres || "")
      .split(",")
      .map((genre) => genre.trim())
      .filter(Boolean)
      .forEach((genre) => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });

    if (row.suggestedSongs) {
      suggestedSongs.push(row.suggestedSongs);
    }
  });

  return {
    success: true,
    stats,
    genreCounts,
    suggestedSongs,
    memories,
    guestList,
  };
}

function readRows_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) return [];

  const keys = values[0].map(headerToKey_);
  return values.slice(1).map((row) => {
    const record = {};
    keys.forEach((key, index) => {
      record[key] = row[index];
    });
    return record;
  });
}

function upsertByName_(sheetName, fullName, rowValues) {
  const sheet = getSheet_(sheetName);
  const normalized = normalize_(fullName);
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    const names = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    const existingIndex = names.findIndex((row) => normalize_(row[0]) === normalized);

    if (existingIndex !== -1) {
      sheet.getRange(existingIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
      return;
    }
  }

  sheet.appendRow(rowValues);
}

function deleteByName_(sheetName, fullName) {
  const sheet = getSheet_(sheetName);
  const normalized = normalize_(fullName);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) return;

  const names = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (let index = names.length - 1; index >= 0; index -= 1) {
    if (normalize_(names[index][0]) === normalized) {
      sheet.deleteRow(index + 2);
    }
  }
}

function parsePayload_(event) {
  if (!event || !event.postData || !event.postData.contents) {
    throw new Error("No POST body received.");
  }
  return JSON.parse(event.postData.contents);
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("Set SPREADSHEET_ID or bind this script to the spreadsheet.");
  }
  return active;
}

function getSheet_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Missing sheet: " + sheetName);
  }
  return sheet;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function required_(value, message) {
  const cleaned = clean_(value);
  if (!cleaned) throw new Error(message);
  return cleaned;
}

function clean_(value) {
  return String(value == null ? "" : value).trim();
}

function normalize_(value) {
  return clean_(value).toLowerCase().replace(/\s+/g, " ");
}

function firstName_(value) {
  return clean_(value).split(/\s+/)[0] || "Guest";
}

function headerToKey_(header) {
  const words = String(header).trim().split(/\s+/);
  return words
    .map((word, index) => {
      const cleaned = word.replace(/[^a-zA-Z0-9]/g, "");
      if (index === 0) return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    })
    .join("");
}
