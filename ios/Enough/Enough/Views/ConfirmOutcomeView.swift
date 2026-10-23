import SwiftUI

/// "What did it give back?" — the confirmation form. Nothing is inferred from
/// accepting an idea; only what the user reports here enters My Wins.
struct ConfirmOutcomeView: View {
    let entry: Entry
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var navigation: AppNavigation
    @Environment(\.dismiss) private var dismiss
    @State private var minutes = ""
    @State private var outside = false
    @State private var connecting = false
    @State private var worthwhile: Bool?
    @State private var gave: Set<ValueType> = []
    @State private var planMoment: PlanMoment?
    @State private var brokeSitting: BrokeSitting?
    @State private var additional: AdditionalMovement?
    @State private var combined = ""
    @State private var savedMoney = false
    @State private var saving = ""
    @State private var error = ""

    private let gaveOptions: [(ValueType, String)] = [(.experience, "Enjoyed the moment"), (.social, "Connection"), (.taskCompleted, "Got something done"), (.timeSaved, "Saved time"), (.timeCombined, "Combined activities")]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Eyebrow("How did it go?")
                    Text(store.state.idea(entry.ideaId).title).font(Theme.display(28)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                    Text("Say what actually happened. Nothing is assumed from planning it, and it doesn’t have to match a target.").font(Theme.body(14)).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                    FieldLabel("How many minutes did you spend?")
                    TextField("0 to 240", text: $minutes).keyboardType(.numberPad).fieldBox()
                    FieldLabel("What was part of it?")
                    Toggle("Time outside", isOn: $outside).tint(Theme.accent)
                    Toggle("Time connecting with someone", isOn: $connecting).tint(Theme.accent)
                    FieldLabel("Was it worthwhile for you?")
                    HStack { Chip(label: "Yes", selected: worthwhile == true) { worthwhile = true }; Chip(label: "Not this time", selected: worthwhile == false) { worthwhile = false } }
                    FieldLabel("What else did it give you?", optional: true)
                    WrapChips(items: gaveOptions.map { $0.0 }, label: { v in gaveOptions.first { $0.0 == v }?.1 ?? v.rawValue }, selected: { gave.contains($0) }) { v in if gave.contains(v) { gave.remove(v) } else { gave.insert(v) } }
                    if entry.support != nil {
                        LabeledPicker(label: "Did it happen at the moment you planned? · optional", selection: $planMoment, options: [(nil, "Skip this question")] + PlanMoment.allCases.map { (Optional($0), $0.label) })
                    }
                    LabeledPicker(label: "Did this break up a long stretch of sitting? · optional", selection: $brokeSitting, options: [(nil, "Skip this question"), (.yes, "Yes"), (.no, "No"), (.unsure, "Not sure")])
                    LabeledPicker(label: "Did this idea add movement you otherwise wouldn’t have done? · optional", selection: $additional, options: [(nil, "Skip this question"), (.more, "Yes, more movement"), (.same, "About the same"), (.less, "Less than usual"), (.unsure, "Not sure")])
                    FieldLabel("Minutes combined with an existing task", optional: true)
                    TextField("0", text: $combined).keyboardType(.numberPad).fieldBox()
                    Toggle("I kept some money", isOn: $savedMoney).tint(Theme.accent)
                    if savedMoney {
                        FieldLabel("Amount kept (\(entry.currency))")
                        TextField("0.00", text: $saving).keyboardType(.decimalPad).fieldBox()
                        Note("Only the amount you would otherwise have spent, after any extra costs.")
                    }
                    AlertText(error)
                    Button("Keep this moment") { confirm() }.buttonStyle(.primary)
                }
                .padding(16)
            }
            .background(Theme.paper)
            .scrollDismissesKeyboard(.interactively)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Cancel") { dismiss() } } }
        }
    }

    private func confirm() {
        guard let n = Int(minutes.trimmingCharacters(in: .whitespaces)), (0...240).contains(n), let worthwhile else {
            error = "Enter whole minutes from 0 to 240, tell us whether it was worthwhile, and check your saving (up to 1,000, with at most two decimal places)."; return
        }
        var timeCombined: Int?
        if !combined.trimmingCharacters(in: .whitespaces).isEmpty {
            guard let c = Int(combined.trimmingCharacters(in: .whitespaces)), c >= 0, c <= n else { error = "Combined time must be whole minutes between zero and the time you reported."; return }
            timeCombined = c
        }
        var cents = 0
        if savedMoney {
            guard let parsed = Regions.parseMoney(saving) else { error = "Enter whole minutes from 0 to 240, tell us whether it was worthwhile, and check your saving (up to 1,000, with at most two decimal places)."; return }
            cents = parsed
        }
        let given = gave.isEmpty ? nil : Array(gave).filter { $0 != .moneySaved || cents > 0 }
        do {
            try store.confirm(entryId: entry.id, outcome: Journey.Outcome(minutes: n, outside: outside, connecting: connecting, worthwhile: worthwhile, moneyCents: cents, gave: given, timeCombined: timeCombined, additionalMovement: additional, brokeSitting: brokeSitting, planMoment: planMoment))
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
