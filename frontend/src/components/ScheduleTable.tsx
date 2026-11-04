import React, { useState, useEffect } from 'react';
import { useScheduleStore } from '../types/useScheduleStore';
import type { LocationConfig, LocationId } from '../types/types';

import { ConflictDropdown } from './ConflictDropdown';
import { createSchedule, updateSchedule } from '../services/client';
 
import { Buffer } from 'buffer';
import { saveAs } from 'file-saver';
import * as ExcelJS from 'exceljs';
(window as any).Buffer = Buffer;

interface ScheduleTableProps {
  config: LocationConfig;
}

// ==========================================
// ⏳ MODERN PULSE SKELETON LOADER
// ==========================================
const TableSkeleton: React.FC<{ config: LocationConfig }> = ({ config }) => {
  return (
    <div className="animate-pulse p-4 space-y-4">
      {/* Mobile Loading Layout */}
      <div className="block md:hidden space-y-3">
        {[1, 2].map((n) => (
          <div key={n} className="p-4 border border-gray-100 rounded-xl bg-slate-50 space-y-3">
            <div className="h-5 w-32 bg-slate-200 rounded"></div>
            <div className="grid grid-cols-2 gap-2">
              {config.roles.map((_, idx) => (
                <div key={idx} className="h-10 bg-white border border-gray-100 rounded-lg"></div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Loading Layout */}
      <div className="hidden md:block overflow-x-auto">
        <div className="h-8 bg-slate-100 rounded mb-3 w-full"></div>
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex gap-4 mb-2 py-3 border-b border-slate-100">
            <div className="h-8 bg-slate-100 rounded w-40 flex-shrink-0"></div>
            {config.roles.map((_, idx) => (
              <div key={idx} className="h-8 bg-slate-50/70 rounded w-full"></div>
            ))}
            <div className="h-8 bg-slate-100 rounded w-12 flex-shrink-0"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ScheduleView: React.FC<{ rows: any[]; config: LocationConfig; members: any[] }> = ({ rows, config, members }) => {
  const getMemberName = (id: string) => members.find((m) => String(m.id) === String(id))?.name || '';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'No Date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (rows.length === 0) {
    return <div className="p-8 text-center text-gray-400 italic">No published dates available.</div>;
  }

  return (
    <>
      {/* 📱 Mobile View Card Layout */}
      <div className="block md:hidden divide-y divide-gray-100">
        {rows.map((row) => (
          <div key={row.id} className="p-4 space-y-3 bg-white">
            <div className="font-semibold text-slate-700">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 text-xs">
                📅 {formatDate(row.date)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {config.roles.map((role) => {
                const memberId = row.assignments[role.key];
                const name = getMemberName(memberId);
                return (
                  <div key={role.key} className="p-2 border border-gray-50 rounded-lg bg-slate-50/50">
                    <span className="block text-slate-400 font-medium mb-1">{role.label}</span>
                    {name ? (
                      <span className="inline-block px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 max-w-full truncate">
                        👤 {name}
                      </span>
                    ) : (
                      <span className="text-gray-300 italic">— Empty —</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 💻 Desktop View Table Layout */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="p-4 min-w-[160px]">Serving Date</th>
              {config.roles.map((role) => (
                <th key={role.key} className="p-4 min-w-[150px]">{role.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 text-xs">
                    📅 {formatDate(row.date)}
                  </span>
                </td>
                {config.roles.map((role) => {
                  const memberId = row.assignments[role.key];
                  const name = getMemberName(memberId);
                  return (
                    <td key={role.key} className="p-4">
                      {name ? (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                          👤 {name}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs italic">— Unassigned —</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

// ==========================================
// 🛠️ MAIN SCHEDULE TABLE COMPONENT
// ==========================================
export const ScheduleTable: React.FC<ScheduleTableProps> = ({ config }) => {
  const locationId = config.id as LocationId;

  const {
    schedules,
    addScheduleRow,
    updateRowDate,
    updateAssignment,
    fetchSchedules,
    deleteScheduleRowFromDB,
  } = useScheduleStore();

  const allRows = schedules[locationId] || []; 
  const [viewMode, setViewMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true); 
  const members = useScheduleStore((s) => s.members);

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!fetchSchedules) return;
      try {
        setIsLoading(true);
        await fetchSchedules(locationId);
      } catch (err) {
        console.error("Failed to load location schedules:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [locationId, fetchSchedules]);

  const displayRows = viewMode 
    ? allRows.filter(row => config.roles.some(role => !!row.assignments[role.key])) 
    : allRows; 

  const getMemberName = (id: string) => members.find((m) => String(m.id) === String(id))?.name || '';

  // ==========================================
  // 📥 EXPORT FEATURE HANDLERS
  // ==========================================
  

  const handleSave = async () => {
    try {
        const rowsToSave = displayRows.filter(row => row.date);

        if (rowsToSave.length === 0) {
          alert('Please assign a date before submitting schedule changes.');
          return;
        }

        setIsLoading(true);

        for (const row of rowsToSave) {
            const payload: any = { date: row.date };

            config.roles.forEach((role) => {
                const currentAssignment = row.assignments?.[role.key];
                const value = typeof currentAssignment === 'string' ? currentAssignment : String(currentAssignment || '');
                const dbColumnKey = role.key.endsWith('_id') ? role.key : `${role.key}_id`;
                
                payload[dbColumnKey] = value && value.trim() !== "" && value !== "undefined" && value !== "null" 
                ? value.trim() 
                : null; 
            });

            console.log(`[SAVING] Location: ${locationId} | Payload:`, payload);

            const isExistingRecord = row.id && !String(row.id).startsWith('temp') && !String(row.id).startsWith('row');

            if (isExistingRecord) {
                await updateSchedule(locationId, row.id, payload);
            } else {
                await createSchedule(locationId, payload);
            }
        }

        if (fetchSchedules) {
          await fetchSchedules(locationId); 
        }

        alert('Schedule changes synchronized successfully!');
        setViewMode(true);
    } catch (err: any) {
        console.error(err);
        alert(err?.message || 'Failed to save schedule alterations');
    } finally {
        setIsLoading(false);
    }
  };

  const exportToExcelFormat = async () => {
  if (displayRows.length === 0) return alert("No active records found to compile.");

  // 1. Initialize a new spreadsheet workbook & sheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Schedules');

  // Set global gridlines to visible
  worksheet.views = [{ showGridLines: true }];

  // 2. Add Main Organization Title Headers
  worksheet.mergeCells('A1:J1');
  const mainTitle = worksheet.getCell('A1');
  mainTitle.value = "Lipa New Hope Church Ministries International";
  mainTitle.font = { name: 'Arial', size: 16, bold: true };
  mainTitle.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('A2:J2');
  const subTitle = worksheet.getCell('A2');
  subTitle.value = "Religious Organization";
  subTitle.font = { name: 'Arial', size: 12, italic: true, color: { argb: 'FF555555' } };
  subTitle.alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.addRow([]); // Blank spacer row

  // 3. Group rows by Month/Year dynamically based on their dates
  const groups: { [key: string]: any[] } = {};
  displayRows.forEach(row => {
    if (!row.date) return;
    const dateObj = new Date(row.date);
    const monthYearStr = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    if (!groups[monthYearStr]) groups[monthYearStr] = [];
    groups[monthYearStr].push(row);
  });

  // 4. Build tables for each month group found
  let currentHeaderRowIndex = 4;

  Object.keys(groups).forEach((monthTitle) => {
    // Month Header Section Title (e.g., "JULY 2026")
    worksheet.mergeCells(`A${currentHeaderRowIndex}:J${currentHeaderRowIndex}`);
    const monthHeader = worksheet.getCell(`A${currentHeaderRowIndex}`);
    monthHeader.value = monthTitle;
    monthHeader.font = { name: 'Arial', size: 14, bold: true };
    monthHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentHeaderRowIndex).height = 25;

    // Table Column Labels
    const headers = ["Date", ...config.roles.map(r => r.label)];
    const labelRow = worksheet.addRow(headers);
    labelRow.height = 22;

    // Apply the exact custom light green layout styling from your image
    labelRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF92D050' } // Custom church schedule green accent tint
      };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    // Populate data rows for this specific month group
    groups[monthTitle].forEach((row) => {
      const dateDay = new Date(row.date).getDate(); // Extract just the day number (e.g., 5, 12, 19)
      const dataLine = [
        dateDay,
        ...config.roles.map(role => getMemberName(row.assignments[role.key]) || '—')
      ];

      const insertedRow = worksheet.addRow(dataLine);
      insertedRow.height = 20;

      insertedRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { 
            horizontal: colNumber === 1 ? 'center' : 'left', 
            vertical: 'middle',
            wrapText: true // Add this line to handle long names gracefully
        };
    });
    });

    // Append the custom footer note seen in your document image
    const noteRow = worksheet.addRow([]);
    worksheet.mergeCells(`A${noteRow.number}:J${noteRow.number}`);
    const noteCell = worksheet.getCell(`A${noteRow.number}`);
    noteCell.value = "Note: To All members: General Cleaning will be conducted after the rehearsal. Thank you!";
    noteCell.font = { name: 'Arial', size: 11, bold: true, italic: true };
    noteCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(noteRow.number).height = 25;

    worksheet.addRow([]); // Blank spacer row between upcoming months
    currentHeaderRowIndex = noteRow.number + 2; 
  });

  // Auto-fit spreadsheet column widths based on contents so nothing looks cut off
  worksheet.columns = [
    { key: 'date', width: 10 }, // Fixed width for the Date column
    ...config.roles.map(role => ({ 
        key: role.key, 
        width: 20 // Set a reasonable fixed width for all role columns
    }))
  ];

  // Ensure text wraps for roles so names don't spill over
    worksheet.columns.forEach((col, index) => {
    if (index > 0) { // For all columns except the date
        col.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    }
    });

  // 5. Build, write out binary stream, and trigger client disk file save
  const dataBuffer = await workbook.xlsx.writeBuffer();
  const fileBlob = new Blob([dataBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(fileBlob, `Church_Deployment_Schedule.xlsx`);
};

  return (
    <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden mb-8">
      {/* Dynamic Action & Control Header */}
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row gap-3 justify-between sm:items-center sticky top-0 z-10">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-gray-800">{config.name} Deployment Schedule</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Currently viewing in <span className="font-semibold text-slate-600">{viewMode ? 'View/Print Mode' : 'Interactive Edit Mode'}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
          {/* Quick Download Utilities (Always visible for easy access) */}
          <button
            onClick={exportToExcelFormat}
            title="Download CSV Spreadsheet"
            className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            📊 CSV
          </button>

          <button
            disabled={isLoading}
            onClick={() => setViewMode((v) => !v)}
            className={`flex-1 sm:flex-none justify-center px-3.5 py-1.5 text-sm font-medium rounded-md border transition-all flex items-center gap-1.5 ${
              viewMode
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-white hover:bg-slate-50 text-slate-600 border-gray-300 shadow-sm'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {viewMode ? '✏️ Switch to Edit' : '👁️ View Mode'}
          </button>

          {!viewMode && (
            <>
              <button
                disabled={isLoading}
                onClick={() => addScheduleRow(locationId, '')}
                className="flex-1 sm:flex-none justify-center px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Row
              </button>

              <button
                disabled={isLoading}
                onClick={handleSave}
                className="w-full sm:w-auto justify-center px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 🎯 MAIN CONTENT CONTAINER ENCAPSULATED WITH EXPORT DOM TARGET ID */}
      <div id="printable-schedule-area" className="bg-white">
        {isLoading ? (
          <TableSkeleton config={config} />
        ) : viewMode ? (
          <ScheduleView rows={displayRows} config={config} members={members} />
        ) : (
          <>
            {/* 📱 Mobile Draft Card List */}
            <div className="block md:hidden divide-y divide-gray-200 bg-white">
              {displayRows.length === 0 ? (
                <div className="p-8 text-center text-gray-400 italic text-sm">
                  No draft rows active. Click "+ Add Row" to stage team drafting slots.
                </div>
              ) : (
                displayRows.map((row) => (
                  <div key={row.id} className="p-4 space-y-4">
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Serving Date</label>
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateRowDate(locationId, row.id, e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded font-medium text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                     <button
                          onClick={async () => {
                              try {
                              await deleteScheduleRowFromDB(locationId, row.id);
                              } catch (err: any) {
                              alert(err?.message || "An error occurred while trying to delete the record.");
                              }
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors"
                          title="Delete Row"
                          >
                          🗑️
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {config.roles.map((role) => (
                        <div key={role.key} className="space-y-1">
                          <label className="block text-xs font-medium text-gray-500">{role.label}</label>
                          <ConflictDropdown
                            locationId={locationId}
                            rowId={row.id}
                            date={row.date}
                            members={members}
                            roleKey={role.key}
                            value={row.assignments[role.key] || ''}
                            onChange={(memberId) => updateAssignment(locationId, row.id, role.key, memberId)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 💻 Desktop Draft Table Container */}
            <div className="hidden md:block overflow-x-auto max-h-[450px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="p-3 min-w-[150px]">Serving Date</th>
                    {config.roles.map((role) => (
                      <th key={role.key} className="p-3 min-w-[160px]">{role.label}</th>
                    ))}
                    <th className="p-3 text-center w-16">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 text-sm">
                  {displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={config.roles.length + 2} className="p-8 text-center text-gray-400 italic">
                        No draft rows active. Click "+ Add Date Row" to schedule a new timeline event.
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="p-3">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => updateRowDate(locationId, row.id, e.target.value)}
                            className="w-full p-1 border border-gray-300 rounded font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {config.roles.map((role) => (
                          <td key={role.key} className="p-3">
                            <ConflictDropdown
                              locationId={locationId}
                              rowId={row.id}
                              date={row.date}
                              members={members}
                              roleKey={role.key}
                              value={row.assignments[role.key] || ''}
                              onChange={(memberId) => updateAssignment(locationId, row.id, role.key, memberId)}
                            />
                          </td>
                        ))}

                        <td className="p-3 text-center">
                          <button
                              onClick={async () => {
                                  try {
                                  await deleteScheduleRowFromDB(locationId, row.id);
                                  } catch (err: any) {
                                  alert(err?.message || "An error occurred while trying to delete the record.");
                                  }
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors"
                              title="Delete Row"
                              >
                              🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};