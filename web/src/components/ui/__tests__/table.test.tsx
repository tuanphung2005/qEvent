import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("Table", () => {
  it("renders headers and cells inside a labelled table", () => {
    render(
      <Table aria-label="Danh sách vé">
        <TableHeader>
          <TableRow>
            <TableHead>Tên</TableHead>
            <TableHead className="text-right">Đã soát</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Nguyễn Văn An</TableCell>
            <TableCell className="text-right">3</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table", { name: "Danh sách vé" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Tên" })).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn An")).toBeInTheDocument();
  });
});
