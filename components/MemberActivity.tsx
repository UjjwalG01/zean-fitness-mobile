import { useRouter } from "expo-router";
import { CalendarCheck } from "lucide-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export function MemberAcitvity() {
  const router = useRouter();
  return (
    <View>
      <TouchableOpacity
        style={styles.activityBtn}
        onPress={() => router.push("/(client)/activities")} // 👈 Replace with your actual file path in app/
      >
        <CalendarCheck style={{ padding: 0 }} size={8} color="#10b981" />
        <Text style={styles.actionText}>My Bookings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBtn: { justifyContent: "center" },
  actionText: {
    color: "#10b981",
    fontWeight: "bold",
    textTransform: "uppercase",
    fontSize: 8,
    padding: 0,
  },
  activityBtn: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    borderWidth: 1,
    borderColor: "#374151",
  },
});
