import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { statusToneClass } from "@/lib/format/status-label";
import { UserRoundPlus, UsersRound } from "lucide-react";
import { useState } from "react";
import { useOutletContext } from "react-router";
import { toast } from "sonner";
import { useAssignEventHost, useEventHosts, useHostAccounts, useUnassignEventHost } from "../api";
import type { EventTabContext } from "../types";

export function HostsTab() {
  const { event } = useOutletContext<EventTabContext>();
  const { user } = useAuth();
  const canEdit = user?.role === "ORGANIZER";
  const hostsQuery = useEventHosts(event.id);
  const accountsQuery = useHostAccounts(canEdit);
  const assign = useAssignEventHost(event.id);
  const unassign = useUnassignEventHost(event.id);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [hostToRemove, setHostToRemove] = useState<string | null>(null);

  const hosts = hostsQuery.data?.hosts ?? [];
  const accounts = accountsQuery.data?.users ?? [];
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const available = accounts.filter((account) => !hosts.some((host) => host.userId === account.id));

  if (hostsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Người dẫn được phân công</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Host chỉ mở được màn trình chiếu và sửa nội dung của sự kiện này.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {hosts.length} host
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger aria-label="Chọn tài khoản host" className="w-full sm:w-[320px]">
                  <SelectValue placeholder="Chọn tài khoản HOST" />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Không còn tài khoản HOST để gán
                    </SelectItem>
                  ) : (
                    available.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.fullName} · {account.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                className="gap-1.5"
                disabled={!selectedUserId || selectedUserId === "__none" || assign.isPending}
                onClick={() =>
                  assign.mutate(selectedUserId, {
                    onSuccess: () => {
                      setSelectedUserId("");
                      toast.success("Đã phân công host cho sự kiện");
                    },
                    onError: () => toast.error("Không phân công được host"),
                  })
                }
              >
                <UserRoundPlus className="size-4" />
                Phân công
              </Button>
            </div>
          ) : null}

          {hosts.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Chưa phân công host</EmptyTitle>
                <EmptyDescription>
                  {canEdit
                    ? "Chọn một tài khoản HOST ở trên để người đó mở được màn trình chiếu của sự kiện này."
                    : "Ban tổ chức chưa phân công người dẫn cho sự kiện này."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-card-border rounded-lg border border-card-border">
              {hosts.map((host) => {
                const account = byId.get(host.userId);
                return (
                  <li key={host.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                      {(account?.fullName ?? host.userId).slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {account?.fullName ?? `Người dùng ${host.userId.slice(-6)}`}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {account?.email ?? host.userId}
                      </p>
                    </div>
                    <Badge variant="secondary" className={statusToneClass("info")}>
                      <UsersRound className="size-3" />
                      HOST
                    </Badge>
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:bg-destructive-subtle hover:text-destructive"
                        onClick={() => setHostToRemove(host.userId)}
                      >
                        Bỏ phân công
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(hostToRemove)}
        onOpenChange={(open) => !open && setHostToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ phân công host?</AlertDialogTitle>
            <AlertDialogDescription>
              Host này sẽ không còn mở được màn trình chiếu hoặc sửa nội dung của sự kiện.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8">Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 bg-destructive text-primary-foreground hover:bg-destructive/90"
              disabled={unassign.isPending}
              onClick={() => {
                if (hostToRemove) {
                  unassign.mutate(hostToRemove, {
                    onSuccess: () => toast.success("Đã bỏ phân công host"),
                    onError: () => toast.error("Không bỏ phân công được"),
                  });
                }
                setHostToRemove(null);
              }}
            >
              Bỏ phân công
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
